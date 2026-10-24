import { Shape } from './Shape.js';

export class Ellipse extends Shape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id, { cx, cy, rx, ry }, ['rx', 'ry']);
  }
  override get tag(): string { return 'ellipse'; }
  override move(dx: number, dy: number): void { this.translate(['cx'], ['cy'], dx, dy); }
  override clone(): Ellipse { return this.copyInto(new Ellipse(this.id, this.value('cx'), this.value('cy'), this.value('rx'), this.value('ry'))); }
  override summary(): string { return this.describe(this.geometrySummary()); }
}
