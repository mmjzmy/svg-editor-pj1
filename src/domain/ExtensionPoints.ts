import type { Shape } from './Shape.js';
export interface ShapeProvider { readonly name: string; create(id: string, params: string[]): Shape; fromAttributes?(id: string, attributes: Record<string,string>, text: string): Shape; }
export interface AttributeHandler { readonly name: string; handles(shape: Shape, attr: string): boolean; apply(shape: Shape, value: string): void; }
