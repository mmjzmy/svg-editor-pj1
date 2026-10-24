export class Numbers {
  static parse(value: string | number, label = 'number'): number {
    const text = String(value);
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      throw new Error(`invalid ${label}: ${text}`);
    }
    const result = Number(text);
    if (!Number.isFinite(result)) throw new Error(`invalid ${label}: ${text}`);
    return Object.is(result, -0) ? 0 : result;
  }

  static nonnegative(value: number, label: string): number {
    Numbers.parse(value, label);
    if (value < 0) throw new Error(`${label} must be non-negative`);
    return value;
  }

  static positive(value: number, label: string): number {
    Numbers.parse(value, label);
    if (value <= 0) throw new Error(`${label} must be positive`);
    return value;
  }

  static format(value: number): string {
    return String(Object.is(value, -0) ? 0 : value);
  }
}
