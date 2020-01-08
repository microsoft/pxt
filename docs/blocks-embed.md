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

## GitHub pages #githubpages

You can use [GitHub pages](https://help.github.com/en/github/working-with-github-pages) to render your README.md file as a web site.

* enable [GitHub pages](https://help.github.com/en/github/working-with-github-pages/creating-a-github-pages-site#creating-your-site) on your repository
* add the url of the editor in ``_config.yml`` (including trailing /)

```
  makecode:
    home_url: @homeurl@
```

* copy the following text at the bottom of your ``README.md`` file
```
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
```

## Other Plugins

Here are some sample integrations for various documentation/blogging engines.

* [React component](https://github.com/microsoft/pxt-react-extension-template/blob/master/src/components/snippet.tsx)
* [HTML only](https://jsfiddle.net/ndyz1d57/80/)
* [MkDocs plugin](https://microsoft.github.io/pxt-mkdocs-sample/)

## Manual Implementation

You can find example of custom blocks embedding in the documentation of your favorite editor.
