import { Group } from '../../src/domain/Group.js';
import { Rect } from '../../src/domain/Rect.js';
import { TextShape } from '../../src/domain/TextShape.js';
import { Numbers } from '../../src/domain/Numbers.js';
import type { Shape } from '../../src/domain/Shape.js';
import type { AttributeHandler, PluginModule, ShapeProvider, TreeDecorator } from '../../src/plugin/api.js';

const DEFAULT_FILL = '#4a90d9';
const rectId = (id: string): string => `${id}-rect`;
const labelId = (id: string): string => `${id}-label`;

class Box extends Group {
  override get label(): string { return `box#${this.id}`; }
  override summary(): string { return `${this.tag}#${this.id}`; }
  override creationSummary(): string {
    return `${this.label} created (${this.tag}#${this.id} + ${this.children.map(child => child.label).join(' + ')})`;
  }
  override get attributes(): Readonly<Record<string, string>> {
    return { ...super.attributes, 'data-kind': 'box' };
  }
  override clone(): Box {
    const copy = new Box(this.id);
    for (const child of this.children) copy.insert(child.clone());
    return copy;
  }
  override canUngroup(): boolean { return false; }
  override ungroupErrorMessage(id: string): string { return `cannot ungroup composite shape: ${id}`; }
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

class BoxProvider implements ShapeProvider {
  readonly name = 'box';

  create(id: string, params: string[]): Shape {
    if (params.length < 4 || params.length > 5) throw new Error('invalid parameters for box: expected x y width height [label]');
    const x = Numbers.parse(params[0]!, 'x');
    const y = Numbers.parse(params[1]!, 'y');
    const width = Numbers.parse(params[2]!, 'width');
    const height = Numbers.parse(params[3]!, 'height');
    const box = new Box(id);
    const rect = new Rect(rectId(id), x, y, width, height);
    rect.setAttribute('fill', DEFAULT_FILL);
    box.insert(rect);
    box.insert(new TextShape(labelId(id), x + 20, y + height / 2 + 5, params[4] ?? ''));
    return box;
  }

  fromAttributes(id: string, attributes: Record<string, string>): Shape {
    const box = new Box(id);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'id' || key === 'data-kind') continue;
      if (['fill', 'stroke', 'stroke-width'].includes(key)) box.setAttribute(key, value);
      else box.preserveAttribute(key, value);
    }
    return box;
  }
}

function child(shape: Shape, suffix: 'rect' | 'label'): Shape {
  const id = suffix === 'rect' ? rectId(shape.id) : labelId(shape.id);
  const found = shape.children.find(candidate => candidate.id === id);
  if (!found) throw new Error(`invalid box ${shape.id}: missing ${id}`);
  return found;
}

class BoxFillHandler implements AttributeHandler {
  readonly name = 'box-fill';
  handles(shape: Shape, attr: string): boolean { return shape instanceof Box && attr === 'fill'; }
  capture(shape: Shape): string | undefined { return child(shape, 'rect').attributes.fill; }
  apply(shape: Shape, value: string): void { child(shape, 'rect').setAttribute('fill', value); }
  describeApply(shape: Shape): string { return `${shape.label} fill propagated to ${shape.id}-rect`; }
  describeUndo(shape: Shape, _attr: string, before: string | undefined): string {
    return `${shape.label} fill restored to ${before ?? 'none'}`;
  }
}

class BoxLabelHandler implements AttributeHandler {
  readonly name = 'box-label';
  handles(shape: Shape, attr: string): boolean { return shape instanceof Box && attr === 'label'; }
  capture(shape: Shape): string | undefined { return child(shape, 'label').textContent; }
  apply(shape: Shape, value: string): void { child(shape, 'label').setAttribute('text', value); }
  describeApply(shape: Shape, _attr: string, value: string): string {
    return `${shape.label} label updated: ${JSON.stringify(value)}`;
  }
  describeUndo(shape: Shape, _attr: string, before: string | undefined): string {
    return `${shape.label} label restored: ${JSON.stringify(before ?? '')}`;
  }
}

class BoxTypeLabel implements TreeDecorator {
  readonly name = 'box-type-label';
  decorate(shape: Shape, line: string): string {
    return shape instanceof Box && !line.endsWith(' (box)') ? `${line} (box)` : line;
  }
}

const module: PluginModule = {
  manifest: { name: 'box', shapes: ['box'], attributes: ['box-fill', 'box-label'], decorators: ['box-type-label'] },
  activate(ctx) {
    ctx.factory.register(new BoxProvider());
    ctx.attributes.register(new BoxFillHandler());
    ctx.attributes.register(new BoxLabelHandler());
    ctx.tree.register(new BoxTypeLabel());
  },
};

export default module;
