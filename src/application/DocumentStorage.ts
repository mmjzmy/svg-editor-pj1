import { SvgDocument } from '../domain/SvgDocument.js';

export interface DocumentStorage {
  read(path: string): Promise<{ document: SvgDocument; warnings: readonly string[] }>;
  write(path: string, document: SvgDocument): Promise<void>;
}
