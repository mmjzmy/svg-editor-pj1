export type DirectoryEntryKind = 'file' | 'directory' | 'other';

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

/** Public port used by the dir command; adapters live in plugin packages. */
export interface DirectoryAccess {
  list(path: string): Promise<DirectoryEntry[]>;
}
