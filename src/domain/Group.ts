import { Shape } from './Shape.js';
import { Numbers } from './Numbers.js';

export class Group extends Shape {
  #children: Shape[] = [];
  constructor(id: string) { super(id, {}); }
  override get tag(): string { return 'g'; }
  override get children(): readonly Shape[] { return [...this.#children]; }
  override asContainer(): Group { return this; }
  override move(dx: number, dy: number): void {
    Numbers.parse(dx, 'dx'); Numbers.parse(dy, 'dy');
    for (const child of this.#children) child.move(dx, dy);
  }
  override scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    for (const child of this.#children) child.scale(factor);
  }
  override clone(): Group {
    const copy = this.copyInto(new Group(this.id));
    for (const child of this.#children) copy.insert(child);
    return copy;
  }
  override summary(): string { return this.describe(''); }
  contains(shape: Shape): boolean {
    return this === shape || this.#children.some(child => child === shape || child.asContainer()?.contains(shape));
  }
  insert(shape: Shape, index = this.#children.length): void {
    if (shape.asContainer()?.contains(this)) {
      throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
    }
    if (this.#children.includes(shape)) throw new Error(`shape already in container: ${shape.id}`);
    this.#children.splice(index, 0, shape);
  }
  remove(shape: Shape): number {
    const index = this.#children.indexOf(shape);
    if (index < 0) throw new Error(`shape not in container: ${shape.id}`);
    this.#children.splice(index, 1);
    return index;
  }
}
