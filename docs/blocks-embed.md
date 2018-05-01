# Blocks embedding

MakeCode provides a lightweight blocks rendering engine that renders code snippets as SVG images. 

## The Curse of screenshots

Unlike text based programming languages, block-based snippets aren't easily rendered in a documentation page. A quick solution is take screenshots of the snippets but things can quickly become unsustainable:

* screenshots can't be compiled - so it's hard to maintain them
* screenshots are not localizable - non-English speaking users won't be able to read the blocks
* screenshots aren't easily reloaded into the editor
* screenshots don't play well with source control systems - you cannot diff changes efficiently

## Rendering blocks on the spot

The MakeCode approach in solving this problem is to render the **JavaScript** code snippets on a client using the same block rendering engine as the editor. Under the hood, an IFrame from the MakeCode editor will render the blocks for you.

## Plugins

Here are some sample integrations for various documentation/blogging engines.

* [GitBook plugin](https://plugins.gitbook.com/plugin/pxt)
* [MkDocs plugin](https://microsoft.github.io/pxt-mkdocs-sample/)

## Manual Implementation

You can find example of custom blocks embedding in the documentation of your favorite editor.
