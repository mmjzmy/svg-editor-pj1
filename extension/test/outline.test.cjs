const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOutline } = require('../dist/outline.js');

const nested = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
  <g id="flowchart">
    <g id="n1">
      <rect id="start" x="40" y="40" width="160" height="60"/>
      <text>开始</text>
    </g>
    <line id="arrow" x1="200" y1="70" x2="240" y2="70"/>
  </g>
</svg>`;

test('builds nested SVG outline with ids and no-id labels', () => {
  const [root] = parseOutline(nested);
  assert.equal(root.label, 'svg');
  assert.equal(root.children.length, 1);
  const flow = root.children[0];
  assert.equal(flow.label, 'g#flowchart');
  assert.equal(flow.children[0].label, 'g#n1');
  assert.deepEqual(flow.children[0].children.map(child => child.label), ['rect#start', 'text']);
  assert.equal(flow.children[1].label, 'line#arrow');
});

test('reports element ranges that start at the source tag', () => {
  const [root] = parseOutline(nested);
  const flow = root.children[0];
  const n1 = flow.children[0];
  const rect = n1.children[0];
  const text = n1.children[1];
  assert.equal(nested.slice(root.start, root.start + 4), '<svg');
  assert.equal(nested.slice(flow.start, flow.start + 2), '<g');
  assert.equal(nested.slice(n1.start, n1.start + 2), '<g');
  assert.equal(nested.slice(rect.start, rect.start + 5), '<rect');
  assert.equal(nested.slice(text.start, text.start + 5), '<text');
  assert.ok(root.start < flow.start && flow.start < n1.start && n1.start < rect.start);
  assert.ok(nested.slice(flow.start, flow.end).endsWith('</g>'));
  assert.ok(nested.slice(rect.start, rect.end).endsWith('/>'));
  assert.ok(nested.slice(text.start, text.end).endsWith('</text>'));
});

test('updates labels and structure when the document changes', () => {
  const before = parseOutline(nested)[0].children[0].children[0];
  assert.equal(before.label, 'g#n1');
  const edited = nested.replace('id="n1"', 'id="renamed"').replace('<text>开始</text>', '<text id="caption">开始</text>');
  const after = parseOutline(edited)[0].children[0].children[0];
  assert.equal(after.label, 'g#renamed');
  assert.equal(after.children[1].label, 'text#caption');
});

test('accepts CRLF and quoted greater-than characters in attributes', () => {
  const crlf = nested.replace(/\n/g, '\r\n');
  const rect = parseOutline(crlf)[0].children[0].children[0].children[0];
  assert.equal(crlf.slice(rect.start, rect.start + 5), '<rect');
  const tricky = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" data="a>b"/></svg>';
  const [root] = parseOutline(tricky);
  assert.equal(root.children[0].label, 'rect#r');
  assert.ok(tricky.slice(root.children[0].start, root.children[0].end).endsWith('/>'));
});

test('returns an empty outline for incomplete or invalid XML', () => {
  assert.deepEqual(parseOutline(''), []);
  assert.deepEqual(parseOutline('<svg><g id="a"><rect id="r"></g></svg>'), []);
  assert.deepEqual(parseOutline('<svg><g id="a">'), []);
  assert.deepEqual(parseOutline('not xml'), []);
  assert.deepEqual(parseOutline('<svg><g id="a"></svg>'), []);
});

test('ignores comments and processing instructions', () => {
  const xml = '<?xml version="1.0"?><svg><!-- comment --><g id="a"><rect id="r"/></g></svg>';
  const [root] = parseOutline(xml);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].label, 'g#a');
  assert.equal(root.children[0].children[0].label, 'rect#r');
});
