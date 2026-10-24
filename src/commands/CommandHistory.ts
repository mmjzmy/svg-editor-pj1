import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';

export class CommandHistory {
  #undo: EditCommand[] = [];
  #redo: EditCommand[] = [];
  #ioBarrier = true;

  execute(command: EditCommand, document: SvgDocument): SvgDocument {
    const result = command.execute(document);
    this.#undo.push(command);
    this.#redo = [];
    this.#ioBarrier = false;
    return result;
  }
  undo(): { document: SvgDocument; message: string } {
    this.checkBarrier();
    const command = this.#undo.at(-1);
    if (!command) throw new Error('nothing to undo');
    const document = command.undo();
    this.#undo.pop(); this.#redo.push(command);
    return { document, message: `undone: ${command.description}` };
  }
  redo(): { document: SvgDocument; message: string } {
    this.checkBarrier();
    const command = this.#redo.at(-1);
    if (!command) throw new Error('nothing to redo');
    const document = command.redo();
    this.#redo.pop(); this.#undo.push(command);
    return { document, message: `redone: ${command.description}` };
  }
  blockAfterIo(): void {
    this.#undo = []; this.#redo = []; this.#ioBarrier = true;
  }
  private checkBarrier(): void {
    if (this.#ioBarrier) throw new Error('undo not allowed after io command');
  }
}
