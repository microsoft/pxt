# Diffs

When comparing two documents, a **diff** is a visual representation of the changes. When the document content is text, a diff is usually shown by displaying two lines of text next to each other with an indication about how the words and symbols in them have changed from one line to the other.

## Blocks

When modifying blocks code, MakeCode will put the blocks in 3 categories:

* **added, changed or moved**: blocks that changed in some way. It may be that a field value changed, or the block was moved or added. They are displayed as regular blocks.
* **deleted**: are blocks that have been removed from the code canvas.
* **not changed**: the blocks that are just the same as before. These are rendered in grey. If a top-level event was not modified at all, MakeCode will not render it in order to "compress" the amount of blocks in the diff.

## Text

MakeCode uses a traditional **inline diff** view where deleted or modified lines are shown with a '**-**' symbol and in red. Modified or added lines are shown with a '**+**' symbol and in green.