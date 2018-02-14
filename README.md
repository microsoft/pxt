# Microsoft MakeCode

* [Try it live!](https://makecode.com)

[![Join the chat at https://gitter.im/makecode-community/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/makecode-community/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/Microsoft/pxt.svg?branch=master)](https://travis-ci.org/Microsoft/pxt)

Microsoft MakeCode is based on the open source project [Microsoft Programming Experience Toolkit (PXT)](https://github.com/Microsoft/pxt). ``Microsoft MakeCode`` is the name in the user-facing editors, ``PXT`` is used in all the GitHub sources.

PXT is a framework for creating special-purpose programming experiences for
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
* [About](https://makecode.com/about)
* [Documentation](https://makecode.com/docs)

Examples of Editors built with PXT:

* https://makecode.microbit.org
* https://makecode.adafruit.com
* https://makecode.chibitronics.com
* https://minecraft.makecode.com
* More editors at https://makecode.com/labs

## Branches

* ``master`` is the active development branch, currently ``v3.*`` builds
* ``v0`` is the servicing branch for ``v0.*`` builds

## Running a target from localhost

Please follow the [instructions here](https://makecode.com/cli).

## Linking a target to PXT

If you are modifying your own instance of PXT and want a target (such as pxt-microbit) to use your local version, cd to the directory of the target (pxt-microbit, in our example, which should be a directory sibling of pxt) and perform

```
npm link ../pxt
```

If you have multiple checkouts of pxt, you can do the following:
* run `npm i` in pxt and the target
* in the target, run `pxt link ..\some-other-pxt` (you may need to update your CLI first by running `npm install -g pxt`)

If you run `npm i` afterwards (in either the target or pxt), you might need to repeat these steps.

## Build

First, install [Node](https://nodejs.org/en/): minimum version 8. Then install the following:
```
npm install -g jake
```

To build the PXT command line tools:

```
npm install
jake
```

Then install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

After this you can run `pxt` from anywhere within the build tree.

To start the local web server, run `pxt serve` from within the root
of an app target (e.g. pxt-microbit). PXT will open the editor in your default web browser.

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

## Tests

The tests are located in the `tests/` subdirectory and are a combination of node and
browser tests. To execute them, run `jake test` in the root directory.

## License

MIT

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
