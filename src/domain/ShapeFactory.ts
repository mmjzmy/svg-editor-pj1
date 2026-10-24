import { Shape } from './Shape.js';
import { Rect } from './Rect.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Line } from './Line.js';
import { TextShape } from './TextShape.js';
import { Group } from './Group.js';
import { Numbers } from './Numbers.js';

type Definition = {
  keys: readonly string[];
  optionalStyle?: string;
  build: (id: string, values: string[]) => Shape;
};

/** The only shape-name dispatch point. Replace static registrations with providers in Phase 2. */
export class ShapeFactory {
  readonly #definitions: ReadonlyMap<string, Definition> = new Map<string, Definition>([
    ['rect', { keys: ['x', 'y', 'width', 'height'], optionalStyle: 'fill',
      build: (id, p) => new Rect(id, Numbers.parse(p[0]!), Numbers.parse(p[1]!), Numbers.parse(p[2]!), Numbers.parse(p[3]!)) }],
    ['circle', { keys: ['cx', 'cy', 'r'], optionalStyle: 'fill',
      build: (id, p) => new Circle(id, Numbers.parse(p[0]!), Numbers.parse(p[1]!), Numbers.parse(p[2]!)) }],
    ['ellipse', { keys: ['cx', 'cy', 'rx', 'ry'], optionalStyle: 'fill',
      build: (id, p) => new Ellipse(id, Numbers.parse(p[0]!), Numbers.parse(p[1]!), Numbers.parse(p[2]!), Numbers.parse(p[3]!)) }],
    ['line', { keys: ['x1', 'y1', 'x2', 'y2'], optionalStyle: 'stroke',
      build: (id, p) => new Line(id, Numbers.parse(p[0]!), Numbers.parse(p[1]!), Numbers.parse(p[2]!), Numbers.parse(p[3]!)) }],
    ['text', { keys: ['x', 'y', 'text'],
      build: (id, p) => new TextShape(id, Numbers.parse(p[0]!), Numbers.parse(p[1]!), p[2]!) }],
    ['g', { keys: [], build: id => new Group(id) }],
  ]);

  create(type: string, id: string, params: string[]): Shape {
    const definition = this.definition(type);
    if (params.length < definition.keys.length || params.length > definition.keys.length + (definition.optionalStyle ? 1 : 0)) {
      throw new Error(`invalid parameters for ${type}: expected ${definition.keys.join(' ') || 'no geometry'}${definition.optionalStyle ? ` [${definition.optionalStyle}]` : ''}`);
    }
    const shape = definition.build(id, params);
    const style = params[definition.keys.length];
    if (style !== undefined && definition.optionalStyle) shape.setAttribute(definition.optionalStyle, style);
    return shape;
  }

  fromAttributes(type: string, id: string, attributes: Record<string, string>, content: string): Shape {
    const definition = this.definition(type);
    const params = definition.keys.map(key => key === 'text' ? content : attributes[key] ?? '0');
    const shape = definition.build(id, params);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'id' || definition.keys.includes(key)) continue;
      if (['fill', 'stroke', 'stroke-width'].includes(key)) shape.setAttribute(key, value);
      else shape.preserveAttribute(key, value);
    }
    return shape;
  }

  private definition(type: string): Definition {
    const definition = this.#definitions.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
