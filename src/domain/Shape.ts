import { Numbers } from './Numbers.js';
import type { Group } from './Group.js';

export abstract class Shape {
  readonly #id: string;
  readonly #geometry: Map<string, number>;
  readonly #nonnegative: ReadonlySet<string>;
  readonly #appearance = new Map<string, string>();
  readonly #preserved = new Map<string, string>();

  protected constructor(id: string, geometry: Record<string, number>, nonnegative: string[] = []) {
    if (!id || /[\s\u0000-\u001f]/u.test(id)) throw new Error(`invalid id: ${id}`);
    this.#id = id;
    this.#geometry = new Map(Object.entries(geometry));
    this.#nonnegative = new Set(nonnegative);
    for (const [key, value] of this.#geometry) this.validateGeometry(key, value);
  }

  get id(): string { return this.#id; }
  abstract get tag(): string;
  get label(): string { return `${this.tag}#${this.id}`; }
  get children(): readonly Shape[] { return []; }
  get textContent(): string | undefined { return undefined; }
  asContainer(): Group | null { return null; }
  abstract move(dx: number, dy: number): void;
  abstract clone(): Shape;
  abstract summary(): string;

  scale(factor: number): void {
    Numbers.positive(factor, 'scale factor');
    const next = new Map(this.#geometry);
    for (const [key, value] of next) {
      next.set(key, this.validateGeometry(key, value * factor));
    }
    for (const [key, value] of next) this.#geometry.set(key, value);
  }

  get attributes(): Readonly<Record<string, string>> {
    return Object.fromEntries([
      ['id', this.id], ...Array.from(this.#geometry, ([k, v]) => [k, Numbers.format(v)]),
      ...this.#appearance, ...this.#preserved,
    ]);
  }

  setAttribute(name: string, value: string): void {
    if (this.#geometry.has(name)) {
      this.#geometry.set(name, this.validateGeometry(name, Numbers.parse(value, name)));
    } else if (['fill', 'stroke', 'stroke-width'].includes(name)) {
      if (name === 'stroke-width') value = Numbers.format(Numbers.nonnegative(Numbers.parse(value, name), name));
      this.#appearance.set(name, value);
    } else {
      throw new Error(`unknown attribute: ${name}`);
    }
  }

  /** Import-only attributes survive a read/save cycle, but are not part of the CLI set whitelist. */
  preserveAttribute(name: string, value: string): void {
    if (name === 'id' || this.#geometry.has(name) || ['fill', 'stroke', 'stroke-width'].includes(name)) {
      throw new Error(`attribute must use setAttribute: ${name}`);
    }
    this.#preserved.set(name, value);
  }

  protected value(name: string): number { return this.#geometry.get(name)!; }
  protected translate(xs: string[], ys: string[], dx: number, dy: number): void {
    Numbers.parse(dx, 'dx'); Numbers.parse(dy, 'dy');
    const changes = [...xs.map(k => [k, this.value(k) + dx] as const),
      ...ys.map(k => [k, this.value(k) + dy] as const)];
    for (const [k, v] of changes) this.validateGeometry(k, v);
    for (const [k, v] of changes) this.#geometry.set(k, v);
  }
  protected geometrySummary(aliases: Record<string, string> = {}): string {
    return Array.from(this.#geometry, ([k, v]) => `${aliases[k] ?? k}=${Numbers.format(v)}`).join(' ');
  }
  protected appearanceSummary(): string {
    return Array.from(this.#appearance, ([k, v]) => `${k}=${v}`).join(' ');
  }
  protected describe(geometry: string): string {
    return [this.label, geometry, this.appearanceSummary()].filter(Boolean).join(' ');
  }
  protected copyInto<T extends Shape>(target: T): T {
    for (const [k, v] of this.#appearance) target.setAttribute(k, v);
    for (const [k, v] of this.#preserved) target.preserveAttribute(k, v);
    return target;
  }
  private validateGeometry(key: string, value: number): number {
    return this.#nonnegative.has(key) ? Numbers.nonnegative(value, key) : Numbers.parse(value, key);
  }
}
