import type { PluginModule } from '../src/plugin/api.js';
const module: PluginModule = { manifest: { name: 'tree-star', decorators: ['modified-star'] }, activate(ctx) { ctx.tree.register({ name: 'modified-star', decorate: (_s,line)=>line }); } };
export default module;
