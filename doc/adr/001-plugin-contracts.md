# ADR 001: Attribute handler contract

## Status

Accepted for Phase 2.

## Context

`set <id> <attr> <value>` must support domain-specific meanings without the kernel
knowing about `box`, `fill`, or `label`. A handler may need to update more than one
child, a handler may throw after a partial change, and one `set` must remain one
undo unit. Several handlers can claim the same shape/attribute pair.

## Decision

The kernel-side interface lives in `src/domain/ExtensionPoints.ts`:

```ts
export interface AttributeHandler {
  readonly name: string;
  handles(shape: Shape, attr: string): boolean;
  apply(shape: Shape, value: string): void;
}
```

- `handles` is a pure predicate and must not mutate the document.
- `apply` receives the target `Shape` object and can use its public API
  (`id`, `children`, `setAttribute`, `textContent`, ...). It does not read private
  fields. The box handlers find `<id>-rect` / `<id>-label` by id and call
  `setAttribute` on those children.
- Handlers are registered by name in `PluginRegistry`. `PluginRegistry.find()`
  returns the first handler in registration order whose `handles` returns true.
  This is a deliberate first-match rule, not a priority or composition system.
  A plugin that needs to override another handler must be loaded first.
- `SetCommand.apply()` calls the first matching handler and does not fall back to
  the Phase 1 whitelist after a handler error.
- The transaction boundary is `EditCommand`: the command runs on `document.clone()`;
  `CommandHistory` only commits the result after `apply` returns. A throw discards
  the candidate, so a handler that changed one or more children cannot leak a
  partial change into the document, undo, or redo.
- One successful `set` is one `EditCommand`, therefore one undo unit. Box `fill`
  and `label` are separate commands and separate undo units.

## Consequences

- The kernel remains generic: no `box`, `label`, or handler-specific branch in
  `SetCommand`.
- A handler failure is visible as a command error and leaves the document and
  history untouched.
- First-match is simple but excludes handler composition; that can be added later
  behind a new policy without changing the interface.
- Because the handler receives the live shape from the candidate document, it can
  update several children inside one `set`; the outer snapshot still rolls them
  all back together.

## Verification

- `test/attribute.test.ts`: first-match order, partial-change throw, box two-child
  rollback, default whitelist fallback when no handler matches, and box undo/redo
  units.
- `test/box.test.ts`: `set n1 fill` updates the inner rect; `set n1 label` updates
  the inner text.
