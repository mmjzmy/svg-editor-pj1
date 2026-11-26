import type { EditorEvent } from '../../src/application/Editor.js';
import type { SvgDocument } from '../../src/domain/SvgDocument.js';
import type { Shape } from '../../src/domain/Shape.js';
import type { PluginModule, TreeDecorator, TreeDecoratorContext } from '../../src/plugin/api.js';

/**
 * Marks rows whose content differs from the last saved/loaded document.
 * The baseline is instance state, and signatures include descendants, so a
 * changed child also marks its ancestors.
 */
class ModifiedStarDecorator implements TreeDecorator {
  readonly name = 'modified-star';
  #baseline = new Map<string, string>();
  #rootBaseline = '';

  snapshot(document: SvgDocument): void {
    this.#baseline.clear();
    for (const shape of document.shapes) this.#baseline.set(shape.id, this.signature(shape));
    this.#rootBaseline = this.rootSignature(document);
  }

  decorate(shape: Shape, line: string, context: TreeDecoratorContext): string {
    const saved = context.isRoot ? this.#rootBaseline : this.#baseline.get(shape.id);
    const current = context.isRoot ? this.rootSignature(context.document) : this.signature(shape);
    return saved === current ? line : `${line} *`;
  }

  private signature(shape: Shape): string {
    const attributes = Object.entries(shape.attributes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return JSON.stringify([shape.tag, shape.id, attributes, shape.textContent ?? null,
      shape.children.map(child => this.signature(child))]);
  }

  private rootSignature(document: SvgDocument): string {
    const attributes = Object.entries(document.rootAttributes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return JSON.stringify([document.width, document.height, attributes, this.signature(document.root)]);
  }
}

const module: PluginModule = {
  manifest: { name: 'tree-star', decorators: ['modified-star'] },
  activate(ctx) {
    const decorator = new ModifiedStarDecorator();
    ctx.tree.register(decorator);
    const editor = ctx.editor;
    if (!editor) return;
    if (editor.hasDocument) decorator.snapshot(editor.document);
    editor.on((event: EditorEvent) => {
      if (event.type === 'save' || event.type === 'read' || event.type === 'init') {
        decorator.snapshot(event.document);
      }
    });
  },
};

export default module;
