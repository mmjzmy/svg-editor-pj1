import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { PluginRegistry } from '../src/plugin/Registry.js';
import { PluginLoader } from '../src/plugin/PluginLoader.js';
test('loader reports missing modules and rolls back an activation failure', async () => { const f=new ShapeFactory(), r=new PluginRegistry(), loader=new PluginLoader(f,r); assert.match((await loader.load({module:'./missing.ts'},process.cwd()))[0]!,/plugin not found/); const result=await loader.load({module:'data:text/javascript,export default {manifest:{name:"bad"},activate(){throw new Error("boom")}}'},process.cwd()); assert.match(result[0]!,/plugin failed to activate/); assert.equal(r.commands.size,0); });
