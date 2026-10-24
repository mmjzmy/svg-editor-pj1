import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '../src/application/Editor.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { GroupCommand } from '../src/commands/GroupCommand.js';
import { ScaleCommand } from '../src/commands/ScaleCommand.js';

const factory = new ShapeFactory();
const editor = (): Editor => new Editor({ read: async () => { throw new Error('read failed'); }, write: async () => {} });
const create = (id: string): CreateCommand => new CreateCommand(factory, 'circle', id, ['1', '2', '3']);

test('one group command is one undo unit and redo restores the complete group', () => {
  const e = editor(); e.init(); e.execute(create('a')); e.execute(create('b'));
  e.execute(new GroupCommand('both', ['b', 'a'])); e.undo();
  assert.deepEqual(e.document.root.children.map(s => s.id), ['a', 'b']);
  e.redo(); assert.deepEqual(e.document.find('both').children.map(s => s.id), ['a', 'b']);
});

test('failed edits preserve tree, redo and IO barrier; valid new edits clear redo', () => {
  const e = editor(); e.init();
  assert.throws(() => e.execute(new MoveCommand('missing', 1, 2)));
  assert.throws(() => e.undo(), /undo not allowed after io command/);
  e.execute(create('a')); e.execute(new MoveCommand('a', 10, 20)); e.undo();
  assert.throws(() => e.execute(new ScaleCommand('a', -1)));
  assert.equal(e.document.find('a').attributes.cx, '1');
  e.redo(); assert.equal(e.document.find('a').attributes.cx, '11');
  e.undo(); e.execute(create('b'));
  assert.throws(() => e.redo(), /nothing to redo/);
});

test('overflow after an earlier child mutation rolls back the entire composite command', () => {
  const e = editor(); e.init(); e.execute(create('a'));
  e.execute(new CreateCommand(factory, 'circle', 'large', ['1e308', '0', '1']));
  e.execute(new GroupCommand('both', ['a', 'large']));
  assert.throws(() => e.execute(new ScaleCommand('both', 2)), /invalid cx/);
  assert.equal(e.document.find('a').attributes.cx, '1');
  e.undo(); assert.deepEqual(e.document.root.children.map(s => s.id), ['a', 'large']);
});

test('save and canvas modification establish a barrier; display and failed IO preserve history', async () => {
  const e = editor(); e.init(); e.execute(create('a')); e.canvas(); e.undo(); e.redo();
  await assert.rejects(e.read('missing'));
  e.undo(); e.redo(); await e.save('a.svg');
  assert.throws(() => e.undo(), /undo not allowed after io command/);
  assert.throws(() => e.redo(), /undo not allowed after io command/);
  e.execute(create('b')); e.undo(); e.redo(); e.canvas(100, 200);
  assert.throws(() => e.undo(), /undo not allowed after io command/);
  e.execute(new MoveCommand('b', 2, 3)); e.undo();
  assert.equal(e.document.find('b').attributes.cx, '1');
});
