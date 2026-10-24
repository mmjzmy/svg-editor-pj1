import { Shape } from './Shape.js';

export class TextShape extends Shape {
  #content: string;
  constructor(id: string, x: number, y: number, content: string) {
    super(id, { x, y });
    this.#content = content;
  }
  override get tag(): string { return 'text'; }
  override get textContent(): string { return this.#content; }
  override move(dx: number, dy: number): void { this.translate(['x'], ['y'], dx, dy); }
  override setAttribute(name: string, value: string): void {
    if (name === 'text') this.#content = value;
    else super.setAttribute(name, value);
  }
  override clone(): TextShape {
    return this.copyInto(new TextShape(this.id, this.value('x'), this.value('y'), this.#content));
  }
  override summary(): string {
    return this.describe(`(${this.value('x')},${this.value('y')}) ${JSON.stringify(this.#content)}`);
  }
}
