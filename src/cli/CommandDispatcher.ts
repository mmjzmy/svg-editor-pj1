import { Editor } from '../application/Editor.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { DocumentRenderer } from '../presentation/DocumentRenderer.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetCommand } from '../commands/SetCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { AddToCommand } from '../commands/AddToCommand.js';
import { ZOrderCommand } from '../commands/ZOrderCommand.js';
import { Tokenizer } from './Tokenizer.js';
import { Arguments } from './Arguments.js';

type Handler = { usage: string; run: (args: Arguments) => string | Promise<string> };

/** The only command-name dispatch point. Phase 2 may inject a command registry. */
export class CommandDispatcher {
  readonly #tokenizer = new Tokenizer();
  readonly #handlers: ReadonlyMap<string, Handler>;
  #shouldExit = false;
  constructor(editor: Editor, factory: ShapeFactory, renderer: DocumentRenderer) {
    this.#handlers = new Map<string, Handler>([
      ['init', { usage: 'init [w] [h]', run: a => {
        a.count(0, 2); return editor.init(a.length >= 1 ? a.number(0, 'width') : 800, a.length === 2 ? a.number(1, 'height') : 600);
      } }],
      ['read', { usage: 'read <file.svg>', run: a => editor.read(a.count(1).value(0)) }],
      ['save', { usage: 'save [file.svg]', run: a => { a.count(0, 1); return editor.save(a.length ? a.value(0) : undefined); } }],
      ['canvas', { usage: 'canvas [w] [h]', run: a => {
        a.count(0, 2); if (a.length === 1) throw new Error('usage: canvas [w] [h]');
        return a.length ? editor.canvas(a.number(0, 'width'), a.number(1, 'height')) : editor.canvas();
      } }],
      ['create', { usage: 'create <type> <id> [params…] [in <containerId>]', run: a => {
        a.count(2, Number.MAX_SAFE_INTEGER);
        return editor.execute(new CreateCommand(factory, a.value(0), a.value(1),
          a.values(2, a.parentSuffix ? a.length - 2 : a.length), a.parentSuffix ? a.value(a.length - 1) : undefined));
      } }],
      ['delete', { usage: 'delete <id>', run: a => editor.execute(new DeleteCommand(a.count(1).value(0))) }],
      ['move', { usage: 'move <id> <dx> <dy>', run: a => {
        a.count(3); return editor.execute(new MoveCommand(a.value(0), a.number(1, 'dx'), a.number(2, 'dy')));
      } }],
      ['scale', { usage: 'scale <id> <factor>', run: a => {
        a.count(2); return editor.execute(new ScaleCommand(a.value(0), a.number(1, 'scale factor')));
      } }],
      ['set', { usage: 'set <id> <attr> <value>', run: a => {
        a.count(3); return editor.execute(new SetCommand(a.value(0), a.value(1), a.value(2)));
      } }],
      ['group', { usage: 'group <newGid> <id1> [id2…]', run: a => {
        a.count(2, Number.MAX_SAFE_INTEGER); return editor.execute(new GroupCommand(a.value(0), a.values(1)));
      } }],
      ['ungroup', { usage: 'ungroup <gid>', run: a => editor.execute(new UngroupCommand(a.count(1).value(0))) }],
      ['addto', { usage: 'addto <gid> <id>', run: a => {
        a.count(2); return editor.execute(new AddToCommand(a.value(0), a.value(1)));
      } }],
      ['front', { usage: 'front <id>', run: a => editor.execute(new ZOrderCommand(a.count(1).value(0), true)) }],
      ['back', { usage: 'back <id>', run: a => editor.execute(new ZOrderCommand(a.count(1).value(0), false)) }],
      ['tree', { usage: 'tree [id]', run: a => {
        a.count(0, 1); return renderer.tree(editor.document, a.length ? a.value(0) : undefined);
      } }],
      ['show', { usage: 'show <id>', run: a => renderer.show(editor.document, a.count(1).value(0)) }],
      ['undo', { usage: 'undo', run: a => { a.count(0); return editor.undo(); } }],
      ['redo', { usage: 'redo', run: a => { a.count(0); return editor.redo(); } }],
      ['help', { usage: 'help', run: a => {
        a.count(0); return Array.from(this.#handlers.values(), handler => handler.usage).join('\n');
      } }],
      ['exit', { usage: 'exit', run: a => { a.count(0); this.#shouldExit = true; return 'bye'; } }],
      ['quit', { usage: 'quit', run: a => { a.count(0); this.#shouldExit = true; return 'bye'; } }],
    ]);
  }
  get shouldExit(): boolean { return this.#shouldExit; }
  async execute(line: string): Promise<string> {
    try {
      const tokens = this.#tokenizer.tokenize(line);
      if (!tokens.length) return '';
      const name = tokens[0]!.value;
      const handler = this.#handlers.get(name);
      if (!handler) throw new Error(`unknown command: ${name}`);
      return await handler.run(new Arguments(tokens.slice(1), handler.usage));
    } catch (error) {
      return `error: ${(error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ')}`;
    }
  }
}
