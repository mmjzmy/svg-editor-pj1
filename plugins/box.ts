import { Group } from '../src/domain/Group.js';
import { Rect } from '../src/domain/Rect.js';
import { TextShape } from '../src/domain/TextShape.js';
import { Numbers } from '../src/domain/Numbers.js';
import type { Shape } from '../src/domain/Shape.js';
import type { AttributeHandler, PluginModule, ShapeProvider, TreeDecorator } from '../src/plugin/api.js';

const rectId = (id: string): string => `${id}-rect`;
const labelId = (id: string): string => `${id}-label`;

class Box extends Group {
  override get attributes(): Readonly<Record<string, string>> {
    return { ...super.attributes, 'data-kind': 'box' };
  }
  override summary(): string { return this.label; }
  override clone(): Box {
    const copy = new Box(this.id);
    for (const child of this.children) copy.insert(child.clone());
    return copy;
  }
  override canUngroup(): boolean { return false; }
  override remove(shape: Shape): number {
    if (shape.id === rectId(this.id) || shape.id === labelId(this.id)) {
      throw new Error(`cannot remove required box child: ${shape.id}`);
    }
    return super.remove(shape);
  }
  override afterRead(): void {
    const rect = this.children.find(child => child.id === rectId(this.id));
    const label = this.children.find(child => child.id === labelId(this.id));
    if (!rect) throw new Error(`invalid box ${this.id}: missing ${rectId(this.id)}`);
    if (!label) throw new Error(`invalid box ${this.id}: missing ${labelId(this.id)}`);
    if (rect.tag !== 'rect') throw new Error(`invalid box ${this.id}: ${rectId(this.id)} must be <rect>`);
    if (label.tag !== 'text') throw new Error(`invalid box ${this.id}: ${labelId(this.id)} must be <text>`);
  }
}

const provider: ShapeProvider = {
  name: 'box',
  create(id, params) {
    if (params.length < 4 || params.length > 5) throw new Error('invalid parameters for box: expected x y width height [label]');
    const x = Numbers.parse(params[0]!, 'x');
    const y = Numbers.parse(params[1]!, 'y');
    const width = Numbers.parse(params[2]!, 'width');
    const height = Numbers.parse(params[3]!, 'height');
    const box = new Box(id);
    box.insert(new Rect(rectId(id), x, y, width, height));
    box.insert(new TextShape(labelId(id), x + width / 2, y + height / 2, params[4] ?? ''));
    return box;
  },
  fromAttributes(id, attributes) {
    const box = new Box(id);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'id' || key === 'data-kind') continue;
      if (['fill', 'stroke', 'stroke-width'].includes(key)) box.setAttribute(key, value);
      else box.preserveAttribute(key, value);
    }
    return box;
  },
};

function child(shape: Shape, suffix: 'rect' | 'label'): Shape {
  const id = suffix === 'rect' ? rectId(shape.id) : labelId(shape.id);
  const found = shape.children.find(candidate => candidate.id === id);
  if (!found) throw new Error(`invalid box ${shape.id}: missing ${id}`);
  return found;
}

const fillHandler: AttributeHandler = {
  name: 'box-fill',
  handles: (shape, attr) => shape instanceof Box && attr === 'fill',
  apply: (shape, value) => child(shape, 'rect').setAttribute('fill', value),
};

const labelHandler: AttributeHandler = {
  name: 'box-label',
  handles: (shape, attr) => shape instanceof Box && attr === 'label',
  apply: (shape, value) => child(shape, 'label').setAttribute('text', value),
};

const typeLabel: TreeDecorator = {
  name: 'box-type-label',
  decorate: (shape, line) => shape instanceof Box && !line.endsWith(' (box)') ? `${line} (box)` : line,
};

const module: PluginModule = {
  manifest: { name: 'box', shapes: ['box'], attributes: ['box-fill', 'box-label'], decorators: ['box-type-label'] },
  activate(ctx) {
    ctx.factory.register(provider);
    ctx.attributes.register(fillHandler);
    ctx.attributes.register(labelHandler);
    ctx.tree.register(typeLabel);
  },
};

export default module;
