import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';

export class MoveCommand extends EditCommand {
  constructor(private readonly id: string, private readonly dx: number, private readonly dy: number) { super(); }
  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    shape.move(this.dx, this.dy);
    return `${shape.label} moved by (${this.dx},${this.dy})`;
  }
  override undoDescription(document: SvgDocument): string {
    const shape = document.find(this.id);
    return `${shape.label} moved back by (${-this.dx},${-this.dy})`;
  }
  override redoDescription(document: SvgDocument): string {
    const shape = document.find(this.id);
    return `${shape.label} moved by (${this.dx},${this.dy})`;
  }
}
