import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { Editor } from '../src/application/Editor.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { Tokenizer } from '../src/cli/Tokenizer.js';
import { DocumentRenderer } from '../src/presentation/DocumentRenderer.js';

const setup = (): { editor: Editor; cli: CommandDispatcher } => {
  const editor = new Editor({ read: async () => ({ document: new SvgDocument(400, 300), warnings: [] }), write: async () => {} });
  return { editor, cli: new CommandDispatcher(editor, new ShapeFactory(), new DocumentRenderer()) };
};

test('tokenizer handles comments, colors, empty strings, escaped quotes, CRLF and Unicode', () => {
  const lexer = new Tokenizer();
  assert.deepEqual(lexer.tokenize('   # comment'), []);
  assert.deepEqual(lexer.tokenize('  \r\n '), []);
  assert.deepEqual(lexer.tokenize('set t text "开始 \\"quoted\\""').map(t => t.value), ['set', 't', 'text', '开始 "quoted"']);
  assert.deepEqual(lexer.tokenize('create rect r 0 0 1 1 #fff').map(t => t.value).at(-1), '#fff');
  assert.equal(lexer.tokenize('set t text ""').at(-1)!.value, '');
  assert.equal(lexer.tokenize('"a\\nb\\tc\\rd\\\\e\\q"')[0]!.value, 'a\nb\tc\rd\\e\\q');
  assert.throws(() => lexer.tokenize('"unclosed'), /unterminated/);
  assert.throws(() => lexer.tokenize('"trailing\\'), /unterminated/);
});

test('complete flowchart session covers create-in, tree/show, composite edits, undo/redo and XML-independent UI', async () => {
  const { editor, cli } = setup();
  const commands = [
    'init 800 600', 'create g flowchart', 'create g node1 in flowchart',
    'create rect start 120 100 160 60 #4a90d9 in node1',
    'create text start-label 155 135 "开始" in node1',
    'create g node2 in flowchart', 'create rect process 520 100 160 60 #f5a623 in node2',
    'create text process-label 545 135 "处理数据" in node2',
    'create line arrow1 280 130 520 130 black in flowchart',
    'move node2 0 100', 'undo', 'redo', 'scale node2 0.5',
    'set process-label text "处理数据 v2"', 'set node1 fill red',
  ];
  for (const command of commands) assert.doesNotMatch(await cli.execute(command), /^error:/, command);
  assert.equal(editor.document.find('process').attributes.y, '100');
  assert.equal(editor.document.find('process').attributes.width, '80');
  const tree = await cli.execute('tree');
  assert.match(tree, /svg \(800x600\)/); assert.match(tree, /└── g#flowchart/);
  assert.match(tree, /rect#process x=260 y=100 w=80 h=30 fill=#f5a623/);
  assert.match(tree, /"处理数据 v2"/); assert.match(tree, /│/);
  assert.doesNotMatch(await cli.execute('tree node2'), /g#node1/);
  assert.match(await cli.execute('show process-label'), /parent=g#node2/);
  assert.match(await cli.execute('show flowchart'), /parent=svg/);
  await cli.execute('undo'); assert.equal(editor.document.find('node1').attributes.fill, undefined);
  await cli.execute('redo'); assert.equal(editor.document.find('node1').attributes.fill, 'red');
});

test('structural commands each undo as a complete unit, retaining child order', async () => {
  const { editor, cli } = setup();
  for (const line of ['init', 'create g scene', 'create circle a 1 2 3 in scene',
    'create ellipse b 4 5 6 7 in scene', 'create g nested in scene', 'addto nested a', 'addto nested b',
    'back b', 'front b', 'group pair b a', 'undo', 'redo', 'ungroup pair', 'undo', 'redo']) {
    assert.doesNotMatch(await cli.execute(line), /^error:/, line);
  }
  assert.deepEqual(editor.document.find('nested').children.map(s => s.id), ['a', 'b']);
  await cli.execute('delete nested'); assert.throws(() => editor.document.find('a'));
  await cli.execute('undo'); assert.equal(editor.document.find('a').tag, 'circle');
  await cli.execute('redo'); assert.throws(() => editor.document.find('nested'));
});

test('quoted in is text content and suffix matching uses token quoting', async () => {
  const { editor, cli } = setup();
  for (const line of ['init', 'create g scene', 'create text t 1 2 "in"', 'create text u 3 4 "in" in scene', 'set t text ""']) {
    assert.doesNotMatch(await cli.execute(line), /^error:/);
  }
  assert.equal(editor.document.find('t').textContent, '');
  assert.equal(editor.document.find('u').textContent, 'in');
});

for (const [line, expected] of [
  ['create circle a 1 2 3', 'error: id already exists: a'],
  ['move missing 1 2', 'error: no such shape: missing'],
  ['create g bad in missing', 'error: no such container: missing'],
  ['create g bad in a', 'error: not a container: a'],
  ['create hexagon bad', 'error: unknown shape type: hexagon (is the plugin loaded?)'],
  ['scale a 0', 'error: scale factor must be positive'],
  ['scale a -2', 'error: scale factor must be positive'],
  ['set a nope 1', 'error: unknown attribute: nope'],
  ['set a id renamed', 'error: unknown attribute: id'],
  ['ungroup a', 'error: not a container: a'],
  ['ungroup scene', 'error: cannot ungroup top-level container: scene'],
  ['group bad scene a', 'error: cannot group a container into its own descendant: scene'],
  ['addto scene scene', 'error: cannot group a container into its own descendant: scene'],
  ['move a NaN 1', 'error: invalid dx: NaN'],
  ['set a r -1', 'error: r must be non-negative'],
  ['set a stroke-width -1', 'error: stroke-width must be non-negative'],
  ['what', 'error: unknown command: what'],
  ['canvas 20', 'error: usage: canvas [w] [h]'],
  ['show a extra', 'error: usage: show <id>'],
  ['set a fill "unclosed', 'error: unterminated quoted argument'],
] as const) {
  test(`failed command preserves document and redo: ${line}`, async () => {
    const { editor, cli } = setup();
    for (const command of ['init', 'create g scene', 'create circle a 1 2 3 in scene', 'move a 10 0', 'undo']) await cli.execute(command);
    const before = new DocumentRenderer().tree(editor.document);
    assert.equal(await cli.execute(line), expected);
    assert.equal(new DocumentRenderer().tree(editor.document), before);
    assert.doesNotMatch(await cli.execute('redo'), /^error:/);
    assert.equal(editor.document.find('a').attributes.cx, '11');
  });
}

test('init defaults, IO barriers, help and no-document behavior are correct', async () => {
  const { editor, cli } = setup();
  for (const line of ['tree', 'save', 'canvas', 'undo', 'redo', 'create g g']) {
    assert.equal(await cli.execute(line), "error: no document. use 'init' or 'read' first");
  }
  assert.match(await cli.execute('help'), /create <type>/);
  assert.equal(await cli.execute('# comment'), '');
  assert.equal(await cli.execute(''), '');
  await cli.execute('init 900'); assert.equal(editor.document.height, 600);
  await cli.execute('init'); assert.equal(editor.document.width, 800);
  assert.equal(await cli.execute('undo'), 'error: undo not allowed after io command');
  await cli.execute('create g g'); await cli.execute('canvas'); await cli.execute('tree'); await cli.execute('show g'); await cli.execute('help');
  assert.doesNotMatch(await cli.execute('undo'), /^error:/);
  await cli.execute('redo'); await cli.execute('canvas 100 200');
  assert.equal(await cli.execute('redo'), 'error: undo not allowed after io command');
  await cli.execute('create g a'); await cli.execute('save "path with spaces.svg"');
  assert.equal(await cli.execute('undo'), 'error: undo not allowed after io command');
  await cli.execute('create g b'); await cli.execute('read other.svg');
  assert.equal(editor.document.width, 400);
  assert.equal(await cli.execute('undo'), 'error: undo not allowed after io command');
  assert.equal(await cli.execute('exit'), 'bye'); assert.equal(cli.shouldExit, true);
  const other = setup().cli; assert.equal(await other.execute('quit'), 'bye'); assert.equal(other.shouldExit, true);
});

test('real CLI accepts a multiline piped script in order and exits without a prompt', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: process.cwd(), encoding: 'utf8',
    input: '# replay\r\ninit 400 200\r\ncreate text t 10 20 "Hello 世界"\nmove t 5 6\nundo\nredo\ntree\nunknown\nexit\ncreate g ignored\n',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /text#t \(15,26\) "Hello 世界"/);
  assert.match(result.stdout, /error: unknown command: unknown/);
  assert.match(result.stdout, /bye/);
  assert.doesNotMatch(result.stdout, /ignored|svg>/);
});
