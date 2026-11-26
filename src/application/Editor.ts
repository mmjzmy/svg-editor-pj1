import { SvgDocument } from '../domain/SvgDocument.js';
import { EditCommand } from '../commands/EditCommand.js';
import { CommandHistory } from '../commands/CommandHistory.js';
import type { DocumentStorage } from './DocumentStorage.js';

export type EditorEventType = 'init' | 'read' | 'save' | 'edit' | 'undo' | 'redo' | 'canvas';

export interface EditorEvent {
  readonly type: EditorEventType;
  readonly document: SvgDocument;
}

export class Editor {
  #document?: SvgDocument;
  #path?: string;
  readonly #history = new CommandHistory();
  readonly #listeners = new Set<(event: EditorEvent) => void>();
  constructor(private readonly storage: DocumentStorage) {}

  /** Read-only use by presentation. Mutations go through execute or document use cases. */
  get document(): SvgDocument {
    if (!this.#document) throw new Error("no document. use 'init' or 'read' first");
    return this.#document;
  }
  get hasDocument(): boolean { return this.#document !== undefined; }

  /** Observe committed document changes. Returns an unsubscribe function. */
  on(listener: (event: EditorEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  init(width = 800, height = 600): string {
    const candidate = new SvgDocument(width, height);
    this.#document = candidate; this.#path = undefined; this.#history.blockAfterIo();
    this.#emit('init');
    return `canvas ${width}x${height} created`;
  }
  async read(path: string): Promise<string> {
    const loaded = await this.storage.read(path);
    this.#document = loaded.document; this.#path = path; this.#history.blockAfterIo();
    this.#emit('read');
    return [...loaded.warnings, `read ${path} (${loaded.document.shapes.length} elements)`].join('\n');
  }
  async save(path = this.#path): Promise<string> {
    const document = this.document;
    if (path === undefined) throw new Error('no file path. use save <file.svg>');
    await this.storage.write(path, document);
    this.#path = path; this.#history.blockAfterIo();
    this.#emit('save');
    return `saved to ${path} (${document.shapes.length} elements)`;
  }
  canvas(width?: number, height?: number): string {
    const document = this.document;
    if (width !== undefined && height !== undefined) {
      const candidate = document.clone(); candidate.resize(width, height);
      this.#document = candidate; this.#history.blockAfterIo();
      this.#emit('canvas');
    }
    return `canvas ${this.document.width}x${this.document.height}`;
  }
  execute(command: EditCommand): string {
    this.#document = this.#history.execute(command, this.document);
    this.#emit('edit');
    return command.description;
  }
  undo(): string {
    void this.document;
    const result = this.#history.undo(); this.#document = result.document;
    this.#emit('undo');
    return result.message;
  }
  redo(): string {
    void this.document;
    const result = this.#history.redo(); this.#document = result.document;
    this.#emit('redo');
    return result.message;
  }
  #emit(type: EditorEventType): void {
    const event: EditorEvent = { type, document: this.document };
    for (const listener of [...this.#listeners]) listener(event);
  }
}
