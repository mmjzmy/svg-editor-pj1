import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';

export class DeleteCommand extends EditCommand {
  constructor(private readonly id: string) { super(); }
  protected override apply(document: SvgDocument): string { return `${document.delete(this.id).label} deleted`; }
}
