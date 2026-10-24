import { Group } from './Group.js';
import { Shape } from './Shape.js';
import { Numbers } from './Numbers.js';

export class SvgDocument {
  #width: number;
  #height: number;
  readonly #root: Group;
  #rootAttributes: Record<string, string>;

  constructor(width = 800, height = 600, root = new Group('__canvas__'), attributes: Record<string, string> = {}) {
    this.#width = Numbers.positive(width, 'canvas width');
    this.#height = Numbers.positive(height, 'canvas height');
    this.#root = root;
    this.#rootAttributes = { ...attributes };
  }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get root(): Group { return this.#root; }
  get rootAttributes(): Readonly<Record<string, string>> { return { ...this.#rootAttributes }; }
  get shapes(): readonly Shape[] {
    const result: Shape[] = [];
    const visit = (shape: Shape): void => {
      result.push(shape);
      shape.children.forEach(visit);
    };
    this.root.children.forEach(visit);
    return result;
  }
  clone(): SvgDocument { return new SvgDocument(this.width, this.height, this.root.clone(), this.#rootAttributes); }
  resize(width: number, height: number): void {
    Numbers.positive(width, 'canvas width'); Numbers.positive(height, 'canvas height');
    this.#width = width; this.#height = height;
    // Resizing deliberately restores a 1px = 1 user-unit viewport.
    delete this.#rootAttributes.viewBox;
  }
  find(id: string): Shape {
    const shape = this.shapes.find(node => node.id === id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
  container(id: string): Group {
    const shape = this.shapes.find(node => node.id === id);
    if (!shape) throw new Error(`no such container: ${id}`);
    const group = shape.asContainer();
    if (!group) throw new Error(`not a container: ${id}`);
    return group;
  }
  parent(shape: Shape): Group {
    const result = [this.root, ...this.shapes.flatMap(node => node.asContainer() ?? [])]
      .find(group => group.children.includes(shape));
    if (!result) throw new Error(`no parent: ${shape.id}`);
    return result;
  }
  assertAvailable(id: string): void {
    if (this.shapes.some(node => node.id === id) || this.#rootAttributes.id === id) {
      throw new Error(`id already exists: ${id}`);
    }
  }
  add(shape: Shape, parent = this.root): void {
    const ids = new Set<string>();
    const validate = (node: Shape): void => {
      this.assertAvailable(node.id);
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
      node.children.forEach(validate);
    };
    validate(shape);
    parent.insert(shape);
  }
  delete(id: string): Shape {
    const shape = this.find(id);
    this.parent(shape).remove(shape);
    return shape;
  }
  group(id: string, ids: string[]): Group {
    this.assertAvailable(id);
    if (!ids.length) throw new Error('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new Error('duplicate shape in group');
    const selected = ids.map(value => this.find(value));
    for (const node of selected) {
      if (selected.some(other => other !== node && node.asContainer()?.contains(other))) {
        throw new Error(`cannot group a container into its own descendant: ${node.id}`);
      }
    }
    const ordered = this.shapes.filter(node => selected.includes(node));
    const ancestors = (shape: Shape): Group[] => {
      const result: Group[] = [];
      let parent = this.parent(shape);
      while (true) {
        result.push(parent);
        if (parent === this.root) return result;
        parent = this.parent(parent);
      }
    };
    const parent = ancestors(ordered[0]!).find(candidate => ordered.every(node => candidate.contains(node)))!;
    const index = parent.children.findIndex(child => ordered.some(node => child === node || child.asContainer()?.contains(node)));
    const group = new Group(id);
    // Validate before detaching; preserve original document order rather than argument order.
    for (const node of ordered) { this.parent(node).remove(node); group.insert(node); }
    parent.insert(group, index);
    return group;
  }
  ungroup(id: string): number {
    const group = this.container(id);
    const parent = this.parent(group);
    if (parent === this.root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const index = parent.remove(group);
    const children = group.children;
    children.forEach((node, offset) => { group.remove(node); parent.insert(node, index + offset); });
    return children.length;
  }
  addTo(groupId: string, id: string): void {
    const group = this.container(groupId);
    const shape = this.find(id);
    if (shape === group || shape.asContainer()?.contains(group)) {
      throw new Error(`cannot group a container into its own descendant: ${id}`);
    }
    this.parent(shape).remove(shape);
    group.insert(shape);
  }
  reorder(id: string, front: boolean): void {
    const shape = this.find(id);
    const parent = this.parent(shape);
    parent.remove(shape);
    parent.insert(shape, front ? parent.children.length : 0);
  }
}
