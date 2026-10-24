import { SvgDocument } from '../domain/SvgDocument.js';
import { EditCommand } from '../commands/EditCommand.js';
import { CommandHistory } from '../commands/CommandHistory.js';
import type { DocumentStorage } from './DocumentStorage.js';

export class Editor {
  #document?: SvgDocument;
  #path?: string;
  readonly #history = new CommandHistory();
  constructor(private readonly storage: DocumentStorage) {}

  /** Read-only use by presentation. Mutations go through execute or document use cases. */
  get document(): SvgDocument {
    if (!this.#document) throw new Error("no document. use 'init' or 'read' first");
    return this.#document;
  }
  init(width = 800, height = 600): string {
    const candidate = new SvgDocument(width, height);
    this.#document = candidate; this.#path = undefined; this.#history.blockAfterIo();
    return `canvas ${width}x${height} created`;
  }
  async read(path: string): Promise<string> {
    const loaded = await this.storage.read(path);
    this.#document = loaded.document; this.#path = path; this.#history.blockAfterIo();
    return [...loaded.warnings, `read ${path} (${loaded.document.shapes.length} elements)`].join('\n');
  }
  async save(path = this.#path): Promise<string> {
    const document = this.document;
    if (path === undefined) throw new Error('no file path. use save <file.svg>');
    await this.storage.write(path, document);
    this.#path = path; this.#history.blockAfterIo();
    return `saved to ${path} (${document.shapes.length} elements)`;
  }
  canvas(width?: number, height?: number): string {
    const document = this.document;
    if (width !== undefined && height !== undefined) {
      const candidate = document.clone(); candidate.resize(width, height);
      this.#document = candidate; this.#history.blockAfterIo();
    }
    return `canvas ${this.document.width}x${this.document.height}`;
  }
  execute(command: EditCommand): string {
    this.#document = this.#history.execute(command, this.document);
    return command.description;
  }
  undo(): string {
    void this.document;
    const result = this.#history.undo(); this.#document = result.document;
    return result.message;
  }
  redo(): string {
    void this.document;
    const result = this.#history.redo(); this.#document = result.document;
    return result.message;
  }
}
