import type { Shape } from './Shape.js';
import type { SvgDocument } from './SvgDocument.js';

/** Creates a shape from CLI parameters and reads one back from SVG attributes. */
export interface ShapeProvider {
  readonly name: string;
  create(id: string, params: string[]): Shape;
  fromAttributes?(id: string, attributes: Record<string, string>, text: string): Shape;
}

/** Gives an attribute a domain meaning for a particular shape. */
export interface AttributeHandler {
  readonly name: string;
  handles(shape: Shape, attr: string): boolean;
  apply(shape: Shape, value: string): void;
}

export interface TreeDecoratorContext {
  readonly document: SvgDocument;
  readonly isRoot: boolean;
}

/** Appends a label to one rendered tree line. Implementations keep their own state. */
export interface TreeDecorator {
  readonly name: string;
  decorate(shape: Shape, line: string, context: TreeDecoratorContext): string;
}
