import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';

export class UngroupCommand extends EditCommand {
  constructor(private readonly id: string) { super(); }
  protected override apply(document: SvgDocument): string {
    return `g#${this.id} ungrouped (${document.ungroup(this.id)} children promoted)`;
  }
}
