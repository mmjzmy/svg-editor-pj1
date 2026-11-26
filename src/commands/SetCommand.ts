import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import type { AttributeHandler } from '../domain/ExtensionPoints.js';
export class SetCommand extends EditCommand {
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string, private readonly handlers: AttributeHandler[] = []) { super(); }
  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    const handler = this.handlers.find(candidate => candidate.handles(shape, this.attribute));
    if (handler) handler.apply(shape, this.value); else shape.setAttribute(this.attribute, this.value);
    return `${shape.label} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }
}
