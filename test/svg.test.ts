import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { FileSvgStorage } from '../src/infrastructure/FileSvgStorage.js';
import { Editor } from '../src/application/Editor.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';

const factory = new ShapeFactory();
const codec = new SvgCodec(factory);
const wrap = (body: string, attributes = 'width="400" height="300"'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;

test('missing IDs are assigned after reserving later IDs and warnings follow preorder', () => {
  const loaded = codec.decode(wrap('<rect/><g><circle/><rect id="rect1"/><rect/></g><circle id="circle1"/>'));
  assert.deepEqual(loaded.document.shapes.map(s => s.id), ['rect2', 'g1', 'circle2', 'rect1', 'rect3', 'circle1']);
  assert.deepEqual(loaded.warnings, [
    'warning: assigned id rect2 to unnamed <rect>', 'warning: assigned id g1 to unnamed <g>',
    'warning: assigned id circle2 to unnamed <circle>', 'warning: assigned id rect3 to unnamed <rect>',
  ]);
});

test('SVG round trip preserves six types, nesting, styles, Unicode and XML special characters', () => {
  const source = wrap(`<g id="g" transform="translate(3,4)" opacity="0.5">
    <rect id="r" x="1.5" y="-2" width="3" height="4" fill="#eee"/>
    <circle id="c" cx="1" cy="2" r="3" stroke="black" stroke-width="2"/>
    <ellipse id="e" cx="1" cy="2" rx="3" ry="4"/>
    <line id="l" x1="1" y1="2" x2="3" y2="4" stroke="red"/>
    <text id="t" x="1" y="2" text-anchor="middle" font-size="18">开始 &amp; &lt;结束&gt; "双引号"</text>
  </g>`);
  const first = codec.decode(source).document;
  const xml = codec.encode(first);
  const second = codec.decode(xml).document;
  assert.match(xml, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(xml, /&amp; &lt;结束/);
  assert.deepEqual(second.shapes.map(s => [s.tag, s.attributes, s.textContent]), first.shapes.map(s => [s.tag, s.attributes, s.textContent]));
  assert.equal(second.find('g').children.length, 5);
  assert.equal(second.find('e').attributes.fill, undefined);
});

test('external box metadata degrades to an ordinary group without a plugin', () => {
  const doc = codec.decode(wrap('<g id="box" data-kind="box"><rect id="body"/></g>')).document;
  assert.ok(doc.find('box').asContainer());
  assert.equal(doc.find('box').attributes['data-kind'], 'box');
});

test('viewBox and root metadata are preserved until canvas resizing', () => {
  const doc = codec.decode(wrap('', 'viewBox="-20 -30 200 100" preserveAspectRatio="xMidYMid meet"')).document;
  assert.equal(doc.width, 200); assert.equal(doc.height, 100);
  assert.match(codec.encode(doc), /viewBox="-20 -30 200 100"/);
  doc.resize(500, 600);
  assert.match(codec.encode(doc), /viewBox="0 0 500 600"/);
  assert.match(codec.encode(doc), /preserveAspectRatio="xMidYMid meet"/);
  assert.equal(codec.decode(wrap('', 'width="400px" height="200px"')).document.width, 400);
  assert.equal(codec.decode(wrap('', '')).document.height, 600);
});

for (const [name, source, error] of [
  ['duplicate explicit ID', wrap('<rect id="r"/><circle id="r"/>'), /id already exists: r/],
  ['root ID conflict', wrap('<rect id="canvas"/>', 'id="canvas"'), /id already exists: canvas/],
  ['malformed XML', wrap('<g id="g">'), /./],
  ['unquoted XML attribute', wrap('<rect id=r/>'), /./],
  ['wrong root', '<html/>', /expected <svg>/],
  ['unsupported shape', wrap('<path id="p" d="M 0 0"/>'), /unknown shape type: path/],
  ['unsupported text children', wrap('<text id="t"><tspan>hello</tspan></text>'), /unsupported child/],
  ['foreign namespace', wrap('<rect xmlns="urn:other" id="r"/>'), /unsupported namespace/],
  ['bad size', wrap('', 'width="0" height="10"'), /must be positive/],
  ['bad geometry', wrap('<circle id="c" r="-1"/>'), /must be non-negative/],
  ['bad viewBox', wrap('', 'viewBox="0 0 0 20"'), /invalid viewBox/],
  ['bad viewBox arity', wrap('', 'viewBox="0 20"'), /invalid viewBox/],
  ['doctype', '<!DOCTYPE svg>' + wrap(''), /DOCTYPE/],
] as const) {
  test(`invalid SVG rejects ${name}`, () => assert.throws(() => codec.decode(source), error));
}

test('real file IO, default save path, IO barriers and failed import remain transactional', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-editor-'));
  try {
    const file = join(dir, '中文 with spaces.svg');
    const bad = join(dir, 'broken.svg');
    const editor = new Editor(new FileSvgStorage(codec));
    editor.init();
    await assert.rejects(editor.save(), /no file path/);
    editor.execute(new CreateCommand(factory, 'text', 't', ['10', '20', '<A&B> 开始']));
    await editor.save(file);
    await editor.read(file);
    editor.execute(new CreateCommand(factory, 'g', 'g', []));
    await writeFile(bad, '<not-svg/>');
    await assert.rejects(editor.read(bad), /expected <svg>/);
    editor.undo(); editor.redo();
    await assert.rejects(editor.save(join(dir, 'missing', 'a.svg')), /cannot write file/);
    editor.undo(); editor.redo();
    await editor.save();
    assert.throws(() => editor.undo(), /undo not allowed/);
    const saved = codec.decode(await readFile(file, 'utf8')).document;
    assert.equal(saved.find('t').textContent, '<A&B> 开始');
    assert.equal(saved.find('g').tag, 'g');
    assert.deepEqual((await readdir(dir)).sort(), ['broken.svg', '中文 with spaces.svg'].sort());
    await assert.rejects(editor.read(join(dir, 'absent.svg')), /cannot read file/);
    await assert.rejects(editor.save(dir), /cannot write file/);
    assert.deepEqual((await readdir(dir)).sort(), ['broken.svg', '中文 with spaces.svg'].sort());
  } finally { await rm(dir, { recursive: true, force: true }); }
});
