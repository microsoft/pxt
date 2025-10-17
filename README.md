# Microsoft MakeCode

* [Try out the editors in your browser...](https://makecode.com)

Microsoft MakeCode is based on the open source project [Microsoft Programming Experience Toolkit (PXT)](https://github.com/microsoft/pxt). ``Microsoft MakeCode`` is the name in the user-facing editors, ``PXT`` is used in all the GitHub sources.

PXT is a framework for creating special-purpose programming experiences for
beginners, especially focused on computer science education. PXT's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of PXT are:
* a Blockly-based code editor along with converter to the text format
* a Monaco code editor that powers [VS Code](https://github.com/microsoft/vscode), editor's features are listed [here](https://code.visualstudio.com/docs/editor/editingevolved).
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

More info:
* [About](https://makecode.com/about)
* [Documentation](https://makecode.com/docs)

Examples of Editors built with MakeCode:

* https://makecode.microbit.org
* https://arcade.makecode.com
* https://makecode.adafruit.com
* https://minecraft.makecode.com
* https://makecode.mindstorms.com
* https://makecode.chibitronics.com
* More editors at https://makecode.com/labs

## Branches

* ``master`` is the active development branch, currently ``v3.*`` builds
* ``v*`` is the servicing branch for ``v*.*`` builds

## Running a target from localhost

Please follow the [instructions here](https://makecode.com/cli).

## Linking a target to PXT

If you are modifying your own instance of PXT and want a target (such as pxt-microbit) to use your local version, cd to the directory of the target (pxt-microbit, in our example, which should be a directory sibling of pxt) and perform

```
pxt link ../pxt
```

If you have multiple checkouts of pxt, you can do the following:
* run `npm i` in pxt and the target
* in the target, run `pxt link ..\some-other-pxt` (you may need to update your CLI first by running `npm install -g pxt`)

If you run `npm i` afterwards (in either the target or pxt), you might need to repeat these steps.

## Build

First, install [Node](https://nodejs.org/en/): minimum version 16.

To build the PXT command line tools:

```
npm install
npm run build
```

Then install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

Then install `gulp` (only need to do it once):
```
npm install -g gulp
```

After this you can run `pxt` from anywhere within the build tree.

To start the local web server, run `pxt serve` from within the root
of an app target (e.g. pxt-microbit). PXT will open the editor in your default web browser.

If you are developing against pxt, you can run `gulp watch` from within the root of the
pxt repository to watch for changes and rebuild.

```
gulp watch
```

If you are working on the CLI exclusively,

```
gulp watchCli
```

If you don't need to build the suite of associated webapps (skillmap, multiplayer, etc.), you can skip them and speed up your build a bit:

```
gulp --no-webapps
```


### Icons

There are a number of custom icons (to use in addition
to http://semantic-ui.com/elements/icon.html) in the `svgicons/` directory.
These need to be `1000x1000px`. Best start with an existing one. To see available icons go to
http://localhost:3232/icons.html (this file, along with `icons.css` containing
the generated WOFF icon font, is created during build).

If you're having trouble with display of the icon you created, try:
```
npm install -g svgo
svgo svgicons/myicon.svg
```

### Shared Styling

When adding a CSS color or other style element that will be shared across editor targets (e.g. micro:bit, Arcade) and sub-applications (a.k.a. "CRAs", like skillmap, teachertool, etc.). Declare a CSS variable for it in `theme/themepacks.less`:

1. Add the new variable to the `:root` pseudo-class. Choose a reasonable default value according to the guidlines in the file.
2. Add the new variable to all theme classes defined in that file. At the time of this writing, only `theme-highcontrast` is defined. Choose a value that works well for the given theme.
3. Add the new variable to the theme overrides for each target. This will be done in the target repo's `theme/themepacks.less` file (e.g. pxt-microbit, pxt-arcade).

Variables declared this way will be available to CRAs at runtime, and they will be initialized with the override values defined by the target in which they're running.


### Documentation Highlighting

In the documentation, highlighting of code snippets uses highlight.js (hljs).
Currently, the following languages are included:

* TypeScript
* Python
* JavaScript
* HTML,XML
* Markdown

If you need to add other languages or update existing ones,
you can find the distribution at [https://highlightjs.org/download/](https://highlightjs.org/download/);
select all the languages you want to include (including the ones above!),
download and unzip,
and finally copy over `highlight.pack.js` into `webapp/public/highlight.js/`.

## Tests

The tests are located in the `tests/` subdirectory and are a combination of node and
browser tests. To execute them, run `npm run test:all` in the root directory.

## License

[MIT License](https://github.com/microsoft/pxt/blob/master/LICENSE)

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Contact Us

[Get in touch](https://makecode.com/contact)

## Trademarks

MICROSOFT, the Microsoft Logo, and MAKECODE are registered trademarks of Microsoft Corporation. They can only be used for the purposes described in and in accordance with Microsoft’s Trademark and Brand guidelines published at https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general.aspx. If the use is not covered in Microsoft’s published guidelines or you are not sure, please consult your legal counsel or MakeCode team (makecode@microsoft.com).
