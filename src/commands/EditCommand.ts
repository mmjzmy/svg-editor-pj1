import { SvgDocument } from '../domain/SvgDocument.js';

/** Command + Memento: execute on an isolated copy; commit only after complete success. */
export abstract class EditCommand {
  #before?: SvgDocument;
  #after?: SvgDocument;
  #description = '';
  protected abstract apply(document: SvgDocument): string;

  execute(document: SvgDocument): SvgDocument {
    const candidate = document.clone();
    const description = this.apply(candidate);
    this.#before = document.clone();
    this.#after = candidate.clone();
    this.#description = description;
    return candidate;
  }
  undo(): SvgDocument {
    if (!this.#before) throw new Error('command has not executed');
    return this.#before.clone();
  }
  redo(): SvgDocument {
    if (!this.#after) throw new Error('command has not executed');
    return this.#after.clone();
  }
  get description(): string { return this.#description; }
}
