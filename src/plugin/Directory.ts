import { readdir } from 'node:fs/promises';
export interface DirectoryEntry { name: string; kind: 'file' | 'directory' | 'other'; }
export interface DirectoryAccess { list(path: string): Promise<DirectoryEntry[]>; }
export class FileSystemDirectoryAccess implements DirectoryAccess { async list(path: string): Promise<DirectoryEntry[]> { try { return (await readdir(path, { withFileTypes: true })).map(e => ({ name: e.name, kind: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other' })); } catch { throw new Error(`cannot read directory: ${path}`); } } }
