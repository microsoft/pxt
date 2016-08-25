# Programming Experience Toolkit - pxt.io

* [Try it live!](https://pxt.io)

[![Build Status](https://travis-ci.org/Microsoft/pxt.svg?branch=master)](https://travis-ci.org/Microsoft/pxt)

Programming Experience Toolkit (PXT) is a framework for creating special-purpose programming experiences for
beginners, especially focused on computer science education. PXT's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of PXT are:
* a Blockly-based code editor along with converter to the text format
* an ACE-based text editor with enhanced, robust auto-completion and auto-correction
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

More info:
* [About PXT](https://www.pxt.io/about)
* [Documentation](https://www.pxt.io/docs)

## Running a target from localhost

Please follow [instructions here](https://www.pxt.io/cli).

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

To start the local web app server do `pxt serve` within the root directory
of build tree (where this file sits) and then browse to http://localhost:3232 

### Icons

There is a number of custom icons (to use in addition
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
