import { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import { Shape } from '../domain/Shape.js';
import type { AttributeHandler } from '../domain/ExtensionPoints.js';

export class SetCommand extends EditCommand {
  #handler?: AttributeHandler;
  #before?: string;

  constructor(
    private readonly id: string,
    private readonly attribute: string,
    private readonly value: string,
    private readonly handlers: AttributeHandler[] = [],
  ) { super(); }

  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    const handler = this.handlers.find(candidate => candidate.handles(shape, this.attribute));
    this.#handler = handler;
    this.#before = handler?.capture?.(shape, this.attribute) ?? valueOf(shape, this.attribute);
    if (handler) handler.apply(shape, this.value); else shape.setAttribute(this.attribute, this.value);
    return handler?.describeApply?.(shape, this.attribute, this.value)
      ?? `${shape.label} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }

  override undoDescription(document: SvgDocument): string {
    const shape = document.find(this.id);
    return this.#handler?.describeUndo?.(shape, this.attribute, this.#before)
      ?? `undone: ${this.description}`;
  }

  override redoDescription(document: SvgDocument): string {
    const shape = document.find(this.id);
    return this.#handler?.describeApply?.(shape, this.attribute, this.value)
      ?? `redone: ${this.description}`;
  }
}

function valueOf(shape: Shape, attribute: string): string {
  if (attribute === 'text') return shape.textContent ?? '';
  return shape.attributes[attribute] ?? '';
}
