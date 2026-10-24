import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';

export class GroupCommand extends EditCommand {
  constructor(private readonly id: string, private readonly ids: string[]) { super(); }
  protected override apply(document: SvgDocument): string {
    const group = document.group(this.id, this.ids);
    return `${group.label} created with ${group.children.length} children`;
  }
}
