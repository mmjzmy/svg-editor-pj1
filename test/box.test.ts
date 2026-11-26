import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '../src/application/Editor.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { DocumentRenderer } from '../src/presentation/DocumentRenderer.js';
import { PluginRegistry } from '../src/plugin/Registry.js';
import { createHarness, MemoryStorage } from './support.js';

const wrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${body}</svg>`;

test('box creates derived children and routes fill/label through handlers', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.load({ module: './plugins/box.ts' }), []);
  assert.deepEqual(await h.loader.load({ module: './plugins/stats.ts' }), []);
  await h.cli.execute('init');
  await h.cli.execute('create box b 0 0 20 10 "x"');
  assert.match(await h.cli.execute('set b fill red'), /fill="red"/);
  assert.match(await h.cli.execute('set b label "hello"'), /label="hello"/);
  const tree = await h.cli.execute('tree');
  assert.match(tree, /^└── g#b \(box\)$/m);
  assert.match(tree, /^    ├── rect#b-rect x=0 y=0 w=20 h=10 fill=red$/m);
  assert.match(tree, /^    └── text#b-label \(10,5\) "hello"$/m);
  assert.equal(await h.cli.execute('stats'), 'rect: 1  text: 1  (total 2, containers 1)');
});

test('box serializes data-kind and reads back through the provider', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create box b 0 0 20 10 "x"');
  await h.cli.execute('set b fill red');
  const codec = new SvgCodec(h.factory);
  const xml = codec.encode(h.editor.document);
  assert.match(xml, /data-kind="box"/);

  const decoded = codec.decode(xml).document;
  const box = decoded.find('b');
  assert.equal(box.attributes['data-kind'], 'box');
  assert.deepEqual(box.children.map(child => child.id), ['b-rect', 'b-label']);
  assert.match(new DocumentRenderer().tree(decoded, undefined, h.registry.decorators), /g#b \(box\)/);

  const target = createHarness();
  await target.loader.load({ module: './plugins/box.ts' });
  target.storage.files.set('box.svg', decoded);
  await target.cli.execute('read box.svg');
  await target.cli.execute('set b fill #f5a623');
  await target.cli.execute('set b label "处理数据 v2"');
  const tree = await target.cli.execute('tree');
  assert.match(tree, /rect#b-rect .* fill=#f5a623/);
  assert.match(tree, /text#b-label .* "处理数据 v2"/);
});

test('unregistered box degrades to a normal g and keeps data-kind', async () => {
  const plain = new ShapeFactory();
  const plainCodec = new SvgCodec(plain);
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="20" height="10" fill="red"/><text id="b-label" x="10" y="5">Hi</text></g></svg>`;
  const loaded = plainCodec.decode(xml);
  assert.match(loaded.warnings.join('\n'), /unknown data-kind box/);
  const group = loaded.document.find('b');
  assert.equal(group.tag, 'g');
  assert.equal(group.attributes['data-kind'], 'box');
  assert.deepEqual(group.children.map(child => child.tag), ['rect', 'text']);

  const storage = new MemoryStorage();
  storage.files.set('box.svg', loaded.document);
  const editor = new Editor(storage);
  const registry = new PluginRegistry();
  const cli = new CommandDispatcher(editor, plain, new DocumentRenderer(), registry);
  await cli.execute('read box.svg');
  assert.equal(await cli.execute('set b label "x"'), 'error: unknown attribute: label');
  assert.match(await cli.execute('set b fill blue'), /updated/);
  assert.doesNotMatch(await cli.execute('tree'), /\(box\)/);
});

test('box read rejects missing or wrong required children', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  const codec = new SvgCodec(h.factory);
  assert.throws(() => codec.decode(wrap('<g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="20" height="10"/></g>')),
    /missing b-label/);
  assert.throws(() => codec.decode(wrap('<g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="20" height="10"/><circle id="b-label" cx="1" cy="1" r="1"/></g>')),
    /b-label must be <text>/);
  assert.throws(() => codec.decode(wrap('<g id="b" data-kind="box"><text id="b-label" x="1" y="1">x</text></g>')),
    /missing b-rect/);
});

test('box protects required children and ungroup', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create g g1');
  await h.cli.execute('create box b 0 0 20 10 "x" in g1');
  assert.equal(await h.cli.execute('ungroup b'), 'error: cannot ungroup b');
  assert.match(await h.cli.execute('delete b-rect'), /cannot remove required box child: b-rect/);
  assert.match(await h.cli.execute('addto g1 b-rect'), /cannot remove required box child: b-rect/);
  assert.match(await h.cli.execute('group g2 b-rect b-label'), /cannot remove required box child: b-rect/);
  assert.equal(await h.cli.execute('delete b'), 'g#b deleted');
  assert.doesNotMatch(await h.cli.execute('tree'), /g#b/);
});

test('box rejects id collisions atomically and supports nesting', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create rect b-rect 0 0 10 10');
  assert.match(await h.cli.execute('create box b 0 0 20 10 "x"'), /id already exists: b-rect/);
  assert.doesNotMatch(await h.cli.execute('tree'), /g#b/);

  await h.cli.execute('create box outer 0 0 100 50 "outer"');
  await h.cli.execute('create box inner 10 10 20 10 "inner" in outer');
  const tree = await h.cli.execute('tree');
  assert.match(tree, /g#outer \(box\)/);
  assert.match(tree, /g#inner \(box\)/);

  const codec = new SvgCodec(h.factory);
  const decoded = codec.decode(codec.encode(h.editor.document)).document;
  assert.deepEqual(decoded.find('outer').children.map(child => child.id), ['outer-rect', 'outer-label', 'inner']);
  assert.deepEqual(decoded.find('inner').children.map(child => child.id), ['inner-rect', 'inner-label']);
});
