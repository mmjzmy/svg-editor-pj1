import { ShapeFactory } from './domain/ShapeFactory.js';
import { SvgCodec } from './infrastructure/SvgCodec.js';
import { FileSvgStorage } from './infrastructure/FileSvgStorage.js';
import { Editor } from './application/Editor.js';
import { DocumentRenderer } from './presentation/DocumentRenderer.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Cli } from './cli/Cli.js';

const factory = new ShapeFactory();
const editor = new Editor(new FileSvgStorage(new SvgCodec(factory)));
await new Cli(new CommandDispatcher(editor, factory, new DocumentRenderer())).run();
