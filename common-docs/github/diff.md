# Diffs

When comparing two document, a **diff** is a visual representation of the changes.

## Blocks

When modifying blocks code, MakeCode will put the blocks in 3 categories:

* **added, changed or moved**, blocks that changed in some way. It may be that a field value changed, or the block was moved or added. They are displayed as regular blocks.
* **deleted**, blocks that have been removed from the code canvas.
* **not changed**, the blocks that are just the same as before. Rendered in grey. If a top-level event has not been modified at all, MakeCode will not render to "compress" the amount of blocks in the diff.

## Text

MakeCode uses a traditional **inline diff** view where deleted or modified lines are shown with a **-** symbol and in red. Modified or added lines are shown with a **+** symbol and in green.