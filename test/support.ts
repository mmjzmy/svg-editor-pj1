import { Editor } from '../src/application/Editor.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { PluginRegistry } from '../src/plugin/Registry.js';
import { PluginLoader } from '../src/plugin/PluginLoader.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { DocumentRenderer } from '../src/presentation/DocumentRenderer.js';
import type { DocumentStorage } from '../src/application/DocumentStorage.js';

export class MemoryStorage implements DocumentStorage {
  readonly files = new Map<string, SvgDocument>();
  async read(path: string): Promise<{ document: SvgDocument; warnings: readonly string[] }> {
    const document = this.files.get(path);
    if (!document) throw new Error(`no such file: ${path}`);
    return { document: document.clone(), warnings: [] };
  }
  async write(path: string, document: SvgDocument): Promise<void> {
    this.files.set(path, document.clone());
  }
}

export function createHarness() {
  const factory = new ShapeFactory();
  const registry = new PluginRegistry();
  const storage = new MemoryStorage();
  const editor = new Editor(storage);
  const loader = new PluginLoader(factory, registry, editor);
  const cli = new CommandDispatcher(editor, factory, new DocumentRenderer(), registry);
  return { factory, registry, storage, editor, loader, cli };
}
