# ADR 003: dirty label semantics

## Status

Accepted for Phase 2.

## Context

`modified-star` must mark tree rows that differ from the last saved/loaded
document. It must compose with `(box)`, clear when `undo` returns to the save
point, mark ancestors when a descendant changes, and keep its state in the
decorator instance rather than module globals.

## Decision

- **Interface.** `TreeDecorator` lives in `src/domain/ExtensionPoints.ts`:
  `decorate(shape, line, context)` where context contains the document and an
  `isRoot` flag. `DocumentRenderer.tree` applies decorators in registration order:
  `text = decorator.decorate(shape, text, context)`. With no decorators the
  Phase 1 output is byte-identical.
- **Semantics.** `modified-star` uses "content differs from last successful
  `save`/`read`/`init`", not "an edit command happened". Its baseline is a
  `Map<id, signature>` plus a root signature. A signature includes tag, id,
  sorted attributes, text content, and the recursive signatures of children.
  Therefore a changed child changes every ancestor's signature; ancestors are
  marked. A new shape absent from the baseline is marked.
- **Updates.** `Editor` emits `init/read/save/edit/undo/redo/canvas`. The
  decorator snapshots the document on `init`, `read`, and `save`; it does not
  snapshot on edits. After `save`, a later edit and `undo` back to the saved
  content makes the signatures equal and the stars disappear; `redo` makes them
  differ again. This matches the requested "content vs save point" rule.
- **Root.** The root line compares width, height, root attributes, and the whole
  root subtree, so a canvas resize or a descendant edit marks `svg (...)`.
- **Order and composition.** Decorators are independent instances and compose by
  registration order. In `plugins.config.json`, `box` is loaded before
  `tree-star`, so a modified box line becomes `g#b (box) *` (`(box)` appended
  first, then `*`). Neither decorator knows the other.
- **State.** The baseline is private instance state. `test/tree-decorator.test.ts`
  creates two harnesses and verifies that editing one does not mark the other.

## Consequences

- Undo to the save point clears stars without any special undo hook.
- Saving is the only baseline reset besides initial load; a failed save does not
  reset it.
- Descendant changes propagate to ancestors by construction; there is no separate
  ancestor bookkeeping.
- The signature is content-based and may be larger than a dirty-id set for very
  large documents; this is acceptable for the course scale.

## Verification

- `test/tree-decorator.test.ts`: save → edit → undo to save point → redo,
  `(box)` + `*` composition, per-instance isolation, changed subtree root.
- `test/box.test.ts`: box tree output with and without decorators.
