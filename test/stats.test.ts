import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support.js';

test('stats treats every g/box as a container, including an empty g', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.load({ module: './plugins/stats/index.ts' }), []);
  await h.cli.execute('init');
  await h.cli.execute('create g empty');
  assert.equal(await h.cli.execute('stats'), '(total 0, containers 1)');
});

test('stats counts leaves by first appearance and box leaves normally', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.load({ module: './plugins/stats/index.ts' }), []);
  assert.deepEqual(await h.loader.load({ module: './plugins/box/index.ts' }), []);
  await h.cli.execute('init');
  await h.cli.execute('create text t 0 0 "x"');
  await h.cli.execute('create rect r 0 0 10 10');
  await h.cli.execute('create text t2 0 0 "y"');
  await h.cli.execute('create box b 100 0 20 10 "z"');
  assert.equal(await h.cli.execute('stats'), 'text: 3  rect: 2  (total 5, containers 1)');
});

test('stats handles an empty document and never enters undo history', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/stats/index.ts' });
  await h.cli.execute('init');
  assert.equal(await h.cli.execute('stats'), '(total 0, containers 0)');
  await h.cli.execute('create rect r 0 0 10 10');
  assert.match(await h.cli.execute('stats'), /rect: 1/);
  await h.cli.execute('undo');
  assert.doesNotMatch(await h.cli.execute('tree'), /r/);
  assert.equal(await h.cli.execute('stats'), '(total 0, containers 0)');
});

test('stats appears in help only when loaded', async () => {
  const off = createHarness();
  assert.equal(await off.cli.execute('stats'), 'error: unknown command: stats');
  assert.doesNotMatch(await off.cli.execute('help'), /^stats$/m);

  const on = createHarness();
  await on.loader.load({ module: './plugins/stats/index.ts' });
  assert.match(await on.cli.execute('help'), /^stats$/m);
  assert.doesNotMatch(await on.cli.execute('help'), /^dir$/m);
});
