import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support.js';

test('modified-star follows save, edit, undo to save point and redo', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.load({ module: './plugins/tree-star/index.ts' }), []);
  await h.cli.execute('init');
  await h.cli.execute('create g flow');
  await h.cli.execute('create rect r1 10 20 100 50 in flow');
  await h.cli.execute('save snapshot.svg');

  const clean = 'svg (800x600)\n└── g#flow\n    └── rect#r1 x=10 y=20 w=100 h=50';
  assert.equal(await h.cli.execute('tree'), clean);

  await h.cli.execute('set r1 fill red');
  const edited = await h.cli.execute('tree');
  assert.match(edited, /^svg \(800x600\) \*$/m);
  assert.match(edited, /^└── g#flow \*$/m);
  assert.match(edited, /^    └── rect#r1 .* \*$/m);

  await h.cli.execute('undo');
  assert.equal(await h.cli.execute('tree'), clean);

  await h.cli.execute('redo');
  assert.match(await h.cli.execute('tree'), /^    └── rect#r1 .* \*$/m);

  await h.cli.execute('save snapshot.svg');
  assert.equal(await h.cli.execute('tree'),
    'svg (800x600)\n└── g#flow\n    └── rect#r1 x=10 y=20 w=100 h=50 fill=red');
});

test('box label and modified-star compose in registration order', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.load({ module: './plugins/box/index.ts' }), []);
  assert.deepEqual(await h.loader.load({ module: './plugins/tree-star/index.ts' }), []);
  await h.cli.execute('init');
  await h.cli.execute('create box b 0 0 20 10 "x"');
  const tree = await h.cli.execute('tree');
  assert.match(tree, /^└── g#b \(box\) \*$/m);
  assert.match(tree, /^    ├── rect#b-rect .* \*$/m);
  assert.match(tree, /^    └── text#b-label .* \*$/m);

  await h.cli.execute('save box.svg');
  const saved = await h.cli.execute('tree');
  assert.match(saved, /^└── g#b \(box\)$/m);
  assert.doesNotMatch(saved, /\*/);
});

test('modified-star keeps its baseline per plugin instance, not in module state', async () => {
  const first = createHarness();
  const second = createHarness();
  await first.loader.load({ module: './plugins/tree-star/index.ts' });
  await second.loader.load({ module: './plugins/tree-star/index.ts' });
  await first.cli.execute('init');
  await second.cli.execute('init');
  await first.cli.execute('create rect r1 0 0 10 10');
  assert.match(await first.cli.execute('tree'), /rect#r1 .* \*/);
  assert.doesNotMatch(await second.cli.execute('tree'), /\*/);
});

test('modified-star marks a changed subtree root', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/tree-star/index.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create g flow');
  await h.cli.execute('create rect r1 0 0 10 10 in flow');
  await h.cli.execute('save tree.svg');
  await h.cli.execute('move r1 5 5');
  assert.match(await h.cli.execute('tree flow'), /^g#flow \*$/m);
});
