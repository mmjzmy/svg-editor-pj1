import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

const factory = new ShapeFactory();

test('all six shape types clone, move, scale, and validate attributes polymorphically', () => {
  const shapes = [
    factory.create('rect', 'r', ['1', '2', '3', '4']),
    factory.create('circle', 'c', ['1', '2', '3']),
    factory.create('ellipse', 'e', ['1', '2', '3', '4']),
    factory.create('line', 'l', ['1', '2', '3', '4']),
    factory.create('text', 't', ['1', '2', '开始']),
    factory.create('g', 'g', []),
  ];
  for (const shape of shapes) {
    const copy = shape.clone();
    copy.move(2, 3); copy.scale(2); copy.setAttribute('fill', 'red');
    assert.equal(shape.attributes.fill, undefined);
    assert.equal(copy.attributes.fill, 'red');
    assert.throws(() => copy.setAttribute('id', 'changed'), /unknown attribute/);
  }
  assert.equal(shapes[0]!.attributes.width, '3');
  assert.equal(shapes[4]!.textContent, '开始');
});

test('factory rejects unknown types, bad arity, non-finite numbers and negative sizes', () => {
  assert.throws(() => factory.create('box', 'b', []), /unknown shape type/);
  assert.throws(() => factory.create('g', 'g', ['1']), /invalid parameters/);
  for (const value of ['NaN', 'Infinity', '0x10', '', '1px', '-1']) {
    assert.throws(() => factory.create('circle', 'c', ['0', '0', value]));
  }
  assert.throws(() => factory.create('g', 'bad id', []), /invalid id/);
});

test('nested composite recursively transforms all geometry, including positions', () => {
  const doc = new SvgDocument();
  const outer = factory.create('g', 'outer', []).asContainer()!;
  const inner = factory.create('g', 'inner', []).asContainer()!;
  inner.insert(factory.create('rect', 'r', ['10', '20', '30', '40']));
  outer.insert(inner); doc.add(outer);
  outer.move(5, 10); outer.scale(2);
  assert.deepEqual(doc.find('r').attributes, { id: 'r', x: '30', y: '60', width: '60', height: '80' });
  assert.throws(() => outer.scale(0), /scale factor must be positive/);
  doc.delete('outer'); assert.equal(doc.shapes.length, 0);
});

test('grouping preserves document order and ungrouping restores the nested position', () => {
  const doc = new SvgDocument();
  doc.add(factory.create('g', 'scene', []));
  for (const id of ['a', 'b', 'c']) doc.add(factory.create('circle', id, ['0', '0', '1']), doc.container('scene'));
  doc.group('pair', ['c', 'a']);
  assert.deepEqual(doc.find('pair').children.map(s => s.id), ['a', 'c']);
  assert.deepEqual(doc.find('scene').children.map(s => s.id), ['pair', 'b']);
  doc.ungroup('pair');
  assert.deepEqual(doc.find('scene').children.map(s => s.id), ['a', 'c', 'b']);
  assert.throws(() => doc.ungroup('scene'), /cannot ungroup top-level container/);
});

test('invalid structural operations reject cycles, duplicate IDs and overlapping selections', () => {
  const doc = new SvgDocument();
  doc.add(factory.create('g', 'scene', []));
  doc.add(factory.create('g', 'nested', []), doc.container('scene'));
  assert.throws(() => doc.group('bad', ['scene', 'nested']), /own descendant: scene/);
  assert.throws(() => doc.addTo('nested', 'scene'), /own descendant/);
  assert.throws(() => doc.group('bad', ['nested', 'nested']), /duplicate/);
  assert.throws(() => doc.add(factory.create('g', 'scene', [])), /id already exists/);
  assert.deepEqual(doc.find('scene').children.map(s => s.id), ['nested']);
});

test('cross-parent grouping uses lowest common ancestor and preserves preorder', () => {
  const doc = new SvgDocument();
  for (const id of ['left', 'right']) {
    doc.add(factory.create('g', id, []));
    doc.add(factory.create('circle', `${id}-c`, ['0', '0', '1']), doc.container(id));
  }
  doc.group('both', ['right-c', 'left-c']);
  assert.deepEqual(doc.root.children.map(s => s.id), ['both', 'left', 'right']);
  assert.deepEqual(doc.find('both').children.map(s => s.id), ['left-c', 'right-c']);
});

test('front is last in SVG painter order; back is first; addto appends', () => {
  const doc = new SvgDocument();
  for (const id of ['a', 'b', 'c']) doc.add(factory.create('g', id, []));
  doc.reorder('a', true);
  assert.deepEqual(doc.root.children.map(s => s.id), ['b', 'c', 'a']);
  doc.reorder('a', false);
  assert.deepEqual(doc.root.children.map(s => s.id), ['a', 'b', 'c']);
  doc.addTo('b', 'a'); assert.equal(doc.parent(doc.find('a')).id, 'b');
});


test('document clone deeply isolates every descendant and its attributes', () => {
  const original = new SvgDocument();
  original.add(factory.create('g', 'g', []));
  original.add(factory.create('rect', 'r', ['1', '2', '3', '4']), original.container('g'));
  const copy = original.clone();
  assert.notEqual(original.find('g'), copy.find('g'));
  assert.notEqual(original.find('r'), copy.find('r'));
  copy.find('r').move(10, 20);
  assert.equal(original.find('r').attributes.x, '1');
  assert.equal(copy.find('r').attributes.x, '11');
});

test('move and scale apply the specified geometry rules to every leaf inside nested groups', () => {
  const doc = new SvgDocument();
  doc.add(factory.create('g', 'scene', []));
  doc.add(factory.create('g', 'nested', []), doc.container('scene'));
  for (const [type, params] of [
    ['rect', ['1', '2', '3', '4', 'red']], ['circle', ['1', '2', '3', 'red']],
    ['ellipse', ['1', '2', '3', '4']], ['line', ['1', '2', '3', '4', 'black']],
    ['text', ['1', '2', 'hello']],
  ] as const) doc.add(factory.create(type, type, [...params]), doc.container('nested'));
  doc.find('scene').move(10, 20); doc.find('scene').scale(2);
  assert.deepEqual(doc.find('rect').attributes, { id: 'rect', x: '22', y: '44', width: '6', height: '8', fill: 'red' });
  assert.deepEqual(doc.find('circle').attributes, { id: 'circle', cx: '22', cy: '44', r: '6', fill: 'red' });
  assert.deepEqual(doc.find('ellipse').attributes, { id: 'ellipse', cx: '22', cy: '44', rx: '6', ry: '8' });
  assert.deepEqual(doc.find('line').attributes, { id: 'line', x1: '22', y1: '44', x2: '26', y2: '48', stroke: 'black' });
  assert.deepEqual(doc.find('text').attributes, { id: 'text', x: '22', y: '44' });
  assert.equal(doc.find('text').textContent, 'hello');
});

test('geometry whitelist is type-specific and valid style/geometry changes survive cloning', () => {
  const circle = factory.create('circle', 'c', ['1', '2', '3']);
  circle.setAttribute('cx', '-2.5'); circle.setAttribute('r', '0');
  circle.setAttribute('stroke', '#000'); circle.setAttribute('stroke-width', '1.5');
  assert.throws(() => circle.setAttribute('width', '10'), /unknown attribute/);
  assert.throws(() => circle.setAttribute('text', 'hello'), /unknown attribute/);
  assert.deepEqual(circle.clone().attributes, { id: 'c', cx: '-2.5', cy: '2', r: '0', stroke: '#000', 'stroke-width': '1.5' });
  const text = factory.create('text', 't', ['0', '0', 'old']);
  text.setAttribute('x', '3.5'); text.setAttribute('text', 'new');
  assert.equal(text.clone().textContent, 'new');
  assert.equal(text.clone().attributes.x, '3.5');
});
