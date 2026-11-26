import type { CommandPlugin, PluginModule } from '../src/plugin/api.js';
import { FileSystemDirectoryAccess } from '../src/plugin/Directory.js';
const command: CommandPlugin = { name: 'dir', usage: 'dir', async execute(_editor,args) { if (args.length) throw new Error('usage: dir'); const entries = await new FileSystemDirectoryAccess().list(process.cwd()); const dirs=entries.filter(e=>e.kind==='directory').sort((a,b)=>a.name.localeCompare(b.name)); const files=entries.filter(e=>e.kind!=='directory').sort((a,b)=>a.name.localeCompare(b.name)); return [...dirs.map(e=>`[DIR]  ${e.name}`), ...files.map(e=>`[FILE] ${e.name}`)].join('\n') || '(empty directory)'; } };
const module: PluginModule = { manifest: { name: 'dir', commands: ['dir'] }, activate(ctx) { ctx.commands.register(command); } };
export default module;
