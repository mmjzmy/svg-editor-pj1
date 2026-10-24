import { Shape } from './Shape.js';

export class Circle extends Shape {
  constructor(id: string, cx: number, cy: number, r: number) {
    super(id, { cx, cy, r }, ['r']);
  }
  override get tag(): string { return 'circle'; }
  override move(dx: number, dy: number): void { this.translate(['cx'], ['cy'], dx, dy); }
  override clone(): Circle { return this.copyInto(new Circle(this.id, this.value('cx'), this.value('cy'), this.value('r'))); }
  override summary(): string { return this.describe(this.geometrySummary()); }
}
