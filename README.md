# Programming Experience Toolkit - pxt.io

* [Try it live!](https://pxt.io)

[![Build Status](https://travis-ci.org/Microsoft/pxt.svg?branch=master)](https://travis-ci.org/Microsoft/pxt)

Programming Experience Toolkit (PXT) is a framework for creating special-purpose programming experiences for
beginners, especially focused on computer science education. PXT's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of PXT are:
* a Blockly-based code editor along with converter to the text format
* a Monaco code editor that powers [VS Code](https://github.com/Microsoft/vscode), editor's features are listed [here](https://code.visualstudio.com/docs/editor/editingevolved).
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

More info:
* [About PXT](https://www.pxt.io/about)
* [Documentation](https://www.pxt.io/docs)

## Running a target from localhost

Please follow the [instructions here](https://www.pxt.io/cli).

## Linking a target to PXT

If you are modifying your own instance of PXT and want a target (such as pxt-microbit) to use your local version, cd to the directory of the target (pxt-microbit, in our example, which should be a directory sibling of pxt) and perform

```
npm link ../pxt
```

## Build

First, install Node (http://nodejs.org/). Then install the following:
```
npm install -g jake
npm install -g tsd
```

To build the PXT command line tools:

```
tsd reinstall
npm install
jake
```

Then install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

After this you can run `pxt` from anywhere within the build tree.

To start the local web server, run `pxt serve` from within the root
of an app target (e.g. pxt-microbit) and then browse to http://localhost:3232

Alternatively, if you clone your pxt and pxt-microbit directories next to each
other, you can serve your local pxt-microbit repo from within the pxt repo by
running `jake serve`.


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

## License

MIT

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
