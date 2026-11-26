# ADR 004: loader validation and rollback

## Status

Accepted for Phase 2.

## Context

Plugins can be loaded from startup code or from `plugins.config.json`. Loading
must report the required failures with `error:` messages and keep starting. A
plugin that declares one set of contributions but registers another, registers a
duplicate name, or throws partway through activation must not leave partial
registrations behind.

## Decision

- **One activation path.** `PluginLoader.load()` imports a module and calls
  `activateModule()`. `PluginLoader.loadModule()` accepts an already-imported
  module for code assembly and calls the same method. There is no second
  registration path.
- **Staged registration.** Before `activate`, the loader snapshots
  `ShapeFactory` definitions and `PluginRegistry` commands/decorators/attributes.
  The `PluginContext` wrappers record every registered name by category. Any
  failure restores both snapshots, leaving earlier plugins untouched.
- **Manifest check.** Declarations come from the nearest package.json
  `contributes` (and its `name`); inline/data URL modules without a package.json
  fall back to `mod.contributes`, `manifest.contributes`, or the manifest's
  category fields. After activation the loader compares the declared name sets
  with the recorded sets. A mismatch
  produces `error: plugin manifest mismatch: <name> (declared: …; registered: …)`
  and rolls the plugin back.
- **Duplicates.** `PluginRegistry`/`ShapeFactory` throw
  `duplicate registration: <category>/<name>`. The loader converts that to an
  `error:` line and rolls back only the current plugin. Earlier plugins remain
  loaded.
- **Activation errors.** A throw from `activate` produces
  `error: plugin failed to activate: <name> (<reason>)` and rolls back. The host
  continues with the remaining plugins.
- **Module resolution.** For relative paths the loader checks that the top-level
  file exists; for package names it uses `require.resolve`. A missing top-level
  module is `error: plugin not found: <module>`. If the module exists but import,
  evaluation, or a dependency fails, it is
  `error: plugin failed to load: <module> (<reason>)`; a missing dependency is not
  misreported as a missing plugin.
- **Config validation.** The whole config is validated before any plugin is
  loaded: `plugins` must be an array of objects with a non-empty string `module`,
  optional boolean `enabled`, and optional object `options`. Invalid config yields
  exactly `error: invalid plugin config` and no optional plugin is loaded; the
  built-in Phase 1 capabilities remain. `enabled: false` is skipped; options are
  passed to `activate`; relative paths resolve from the config file's directory.
- **Ordering.** Plugins load in array order. Commands are looked up by name;
  decorators compose in registration order.

## Consequences

- A bad plugin cannot poison the registry or the shape factory.
- The loader knows only public contracts and registries; it contains no concrete
  plugin imports or name tables.
- The manifest must match the actual registrations exactly. This catches
  forgotten or extra registrations at load time rather than at first use.
- The additional `plugin failed to load` message distinguishes dependency/eval
  failures from top-level resolution failures.

## Verification

- `test/loader.test.ts`: manifest mismatch and shape rollback, duplicate command
  plus decorator rollback, activation failure shape rollback, missing module vs
  broken module, missing default export, invalid config variants, options and
  `enabled: false`, code assembly via `loadModule`.
- `test/assembly.test.ts`: a mixed session under code and config assembly produces
  byte-identical output.
- `test/dir.test.ts`: code and config assembly produce byte-identical `dir` output
  for the same fixed directory.
