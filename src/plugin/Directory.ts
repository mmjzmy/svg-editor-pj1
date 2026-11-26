import { readdir } from 'node:fs/promises';

export type DirectoryEntryKind = 'file' | 'directory' | 'other';

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

/** Port used by the dir command; the real adapter is replaceable in tests. */
export interface DirectoryAccess {
  list(path: string): Promise<DirectoryEntry[]>;
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
