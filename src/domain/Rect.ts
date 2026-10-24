import { Shape } from './Shape.js';

export class Rect extends Shape {
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id, { x, y, width, height }, ['width', 'height']);
  }
  override get tag(): string { return 'rect'; }
  override move(dx: number, dy: number): void { this.translate(['x'], ['y'], dx, dy); }
  override clone(): Rect { return this.copyInto(new Rect(this.id, this.value('x'), this.value('y'), this.value('width'), this.value('height'))); }
  override summary(): string { return this.describe(this.geometrySummary({ width: 'w', height: 'h' })); }
}
