import type { CommandPlugin, PluginModule } from '../src/plugin/api.js';
const command: CommandPlugin = { name: 'stats', usage: 'stats', execute(editor) { const counts = new Map<string, number>(); let containers = 0; for (const s of editor.document.shapes) { if (s.children.length) containers++; else counts.set(s.tag, (counts.get(s.tag) ?? 0) + 1); } const text = [...counts].map(([k,v])=>`${k}: ${v}`).join('  '); return `${text}${text ? '  ' : ''}(total ${[...counts.values()].reduce((a,b)=>a+b,0)}, containers ${containers})`; } };
const module: PluginModule = { manifest: { name: 'stats', commands: ['stats'] }, activate(ctx) { ctx.commands.register(command); } };
export default module;
