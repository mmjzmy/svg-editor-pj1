import { readdir } from 'node:fs/promises';
import type { Editor } from '../../src/application/Editor.js';
import type { CommandPlugin, PluginModule } from '../../src/plugin/api.js';
import type { DirectoryAccess, DirectoryEntry } from '../../src/domain/Directory.js';

export interface DirOptions {
  readonly access?: DirectoryAccess;
  readonly cwd?: () => string;
}

const byName = (a: DirectoryEntry, b: DirectoryEntry): number => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/** Renders one directory listing. Kept pure so the command can be tested without a filesystem. */
export function formatEntries(entries: readonly DirectoryEntry[]): string {
  const directories = entries.filter(entry => entry.kind === 'directory').sort(byName);
  const files = entries.filter(entry => entry.kind === 'file').sort(byName);
  const others = entries.filter(entry => entry.kind === 'other').sort(byName);
  return [
    ...directories.map(entry => `[DIR]  ${entry.name}`),
    ...files.map(entry => `[FILE] ${entry.name}`),
    ...others.map(entry => `[OTHER] ${entry.name}`),
  ].join('\n') || '(empty directory)';
}

export class FileSystemDirectoryAccess implements DirectoryAccess {
  async list(path: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
      }));
    } catch {
      throw new Error(`cannot read directory: ${path}`);
    }
  }
}

export class DirCommand implements CommandPlugin {
  readonly name = 'dir';
  readonly usage = 'dir';
  constructor(
    private readonly access: DirectoryAccess = new FileSystemDirectoryAccess(),
    private readonly cwd: () => string = () => process.cwd(),
  ) {}
  async execute(_editor: Editor, args: string[]): Promise<string> {
    if (args.length) throw new Error('usage: dir');
    return formatEntries(await this.access.list(this.cwd()));
  }
}

export function createDirCommand(options: DirOptions = {}): CommandPlugin {
  return new DirCommand(options.access, options.cwd);
}

export function createDirPlugin(defaults: DirOptions = {}): PluginModule {
  return {
    manifest: { name: 'dir', commands: ['dir'] },
    activate(ctx, options) {
      const access = (options?.access as DirectoryAccess | undefined)
        ?? defaults.access
        ?? new FileSystemDirectoryAccess();
      const configuredCwd = options?.cwd;
      const cwd = typeof configuredCwd === 'string' ? (() => configuredCwd) : defaults.cwd ?? (() => process.cwd());
      ctx.commands.register(new DirCommand(access, cwd));
    },
  };
}

export default createDirPlugin();
