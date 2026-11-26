import { Group } from '../src/domain/Group.js';
import { Rect } from '../src/domain/Rect.js';
import { TextShape } from '../src/domain/TextShape.js';
import type { PluginModule, ShapeProvider } from '../src/plugin/api.js';
class Box extends Group {
  override summary(): string { return `${this.label} (box)`; }
  override clone(): Box { const copy = new Box(this.id); for (const child of this.children) copy.insert(child.clone()); return copy; }
}
const provider: ShapeProvider = { name: 'box', create(id, p) { const b = new Box(id); b.insert(new Rect(`${id}-rect`, Number(p[0]), Number(p[1]), Number(p[2]), Number(p[3]))); b.insert(new TextShape(`${id}-label`, Number(p[0]) + Number(p[2]) / 2, Number(p[1]) + Number(p[3]) / 2, p[4] ?? '')); return b; } };
const module: PluginModule = { manifest: { name: 'box', shapes: ['box'], attributes: ['box-fill', 'box-label'], decorators: ['box-type-label'] }, activate(ctx) { ctx.factory.register(provider); ctx.attributes.register({ name: 'box-fill', handles: (s,a)=>s.tag === 'g' && s.summary().includes('(box)') && a === 'fill', apply: (s,v)=>s.children[0]?.setAttribute('fill', v) }); ctx.attributes.register({ name: 'box-label', handles: (s,a)=>s.tag === 'g' && s.summary().includes('(box)') && a === 'label', apply: (s,v)=>s.children[1]?.setAttribute('text', v) }); ctx.tree.register({ name: 'box-type-label', decorate: (s,line)=>s.summary().includes('(box)') ? line : line }); } };
export default module;
