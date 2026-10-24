import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';

export class CreateCommand extends EditCommand {
  constructor(private readonly factory: ShapeFactory, private readonly type: string,
    private readonly id: string, private readonly params: string[], private readonly parentId?: string) { super(); }
  protected override apply(document: SvgDocument): string {
    document.assertAvailable(this.id);
    const parent = this.parentId === undefined ? document.root : document.container(this.parentId);
    const shape = this.factory.create(this.type, this.id, this.params);
    document.add(shape, parent);
    return `${shape.label} created${this.parentId === undefined ? '' : ` in ${parent.label}`}`;
  }
}
