import { FileSystemDirectoryAccess } from '../src/plugin/Directory.js';
import type { DirectoryAccess, DirectoryEntry } from '../src/plugin/Directory.js';
import type { CommandPlugin, PluginModule } from '../src/plugin/api.js';

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

export function createDirCommand(options: DirOptions = {}): CommandPlugin {
  const access = options.access ?? new FileSystemDirectoryAccess();
  const cwd = options.cwd ?? (() => process.cwd());
  return {
    name: 'dir',
    usage: 'dir',
    async execute(_editor, args) {
      if (args.length) throw new Error('usage: dir');
      return formatEntries(await access.list(cwd()));
    },
  };
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
      ctx.commands.register(createDirCommand({ access, cwd }));
    },
  };
}

export default createDirPlugin();
