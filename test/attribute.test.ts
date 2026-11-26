import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support.js';

test('the first matching attribute handler wins in registration order', async () => {
  const h = createHarness();
  h.registry.registerAttribute({ name: 'first', handles: (_shape, attr) => attr === 'fill', apply: shape => shape.setAttribute('fill', 'first') });
  h.registry.registerAttribute({ name: 'second', handles: (_shape, attr) => attr === 'fill', apply: shape => shape.setAttribute('fill', 'second') });
  await h.cli.execute('init');
  await h.cli.execute('create rect r1 0 0 10 10');
  assert.match(await h.cli.execute('set r1 fill red'), /updated/);
  assert.match(await h.cli.execute('tree'), /fill=first/);
  assert.doesNotMatch(await h.cli.execute('tree'), /fill=second/);
});

test('a handler that throws after a partial change does not touch document or history', async () => {
  const h = createHarness();
  h.registry.registerAttribute({
    name: 'boom',
    handles: (_shape, attr) => attr === 'fill',
    apply: shape => { shape.setAttribute('fill', 'changed'); throw new Error('handler boom'); },
  });
  await h.cli.execute('init');
  await h.cli.execute('create rect r1 0 0 10 10');
  const before = await h.cli.execute('tree');
  assert.equal(await h.cli.execute('set r1 fill red'), 'error: handler boom');
  assert.equal(await h.cli.execute('tree'), before);
  await h.cli.execute('undo');
  assert.doesNotMatch(await h.cli.execute('tree'), /r1/);
});

test('a handler that partially edits both box children rolls the whole set back', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  h.registry.attributes.unshift({
    name: 'boom-box',
    handles: (shape, attr) => shape.id === 'b' && attr === 'fill',
    apply: shape => {
      shape.setAttribute('fill', 'outer');
      shape.children.find(child => child.id === 'b-rect')!.setAttribute('fill', 'inner');
      shape.children.find(child => child.id === 'b-label')!.setAttribute('text', 'partial');
      throw new Error('box boom');
    },
  });
  await h.cli.execute('init');
  await h.cli.execute('create box b 0 0 20 10 "x"');
  const before = await h.cli.execute('tree');
  assert.equal(await h.cli.execute('set b fill red'), 'error: box boom');
  assert.equal(await h.cli.execute('tree'), before);
});

test('without a matching handler the Phase 1 whitelist still applies', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create rect r1 0 0 10 10');
  assert.match(await h.cli.execute('set r1 fill red'), /updated/);
  assert.equal(await h.cli.execute('set r1 label x'), 'error: unknown attribute: label');
});

test('each box set is one undo unit', async () => {
  const h = createHarness();
  await h.loader.load({ module: './plugins/box.ts' });
  await h.cli.execute('init');
  await h.cli.execute('create box b 0 0 20 10 "x"');
  await h.cli.execute('set b fill red');
  await h.cli.execute('set b label "hello"');
  assert.match(await h.cli.execute('tree'), /fill=red/);
  assert.match(await h.cli.execute('tree'), /"hello"/);

  await h.cli.execute('undo');
  const afterLabelUndo = await h.cli.execute('tree');
  assert.match(afterLabelUndo, /fill=red/);
  assert.match(afterLabelUndo, /"x"/);

  await h.cli.execute('undo');
  const afterFillUndo = await h.cli.execute('tree');
  assert.doesNotMatch(afterFillUndo, /fill=red/);
  assert.match(afterFillUndo, /"x"/);

  await h.cli.execute('redo');
  assert.match(await h.cli.execute('tree'), /fill=red/);
  await h.cli.execute('redo');
  assert.match(await h.cli.execute('tree'), /"hello"/);
});
