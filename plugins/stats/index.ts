import type { Editor } from '../../src/application/Editor.js';
import type { CommandPlugin, PluginModule } from '../../src/plugin/api.js';

export class StatsCommand implements CommandPlugin {
  readonly name = 'stats';
  readonly usage = 'stats';

  execute(editor: Editor): string {
    const counts = new Map<string, number>();
    let containers = 0;
    for (const shape of editor.document.shapes) {
      if (shape.tag === 'g' || shape.children.length > 0) {
        containers++;
        continue;
      }
      counts.set(shape.tag, (counts.get(shape.tag) ?? 0) + 1);
    }
    const text = [...counts].map(([tag, count]) => `${tag}: ${count}`).join('  ');
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return `${text}${text ? '  ' : ''}(total ${total}, containers ${containers})`;
  }
}

const module: PluginModule = {
  manifest: { name: 'stats', commands: ['stats'] },
  activate(ctx) {
    ctx.commands.register(new StatsCommand());
  },
};

export default module;
