# About

[Microsoft MakeCode](@homeurl@) is a framework for creating interactive and engaging
programming experiences for those new to the world of programming. The platform provides the foundation for a tailored coding experience to create and run user programs on actual hardware or in a simulated target.

![Editor to target](/static/about/editor-to-target.png)

The primary goal of MakeCode is to introduce programming in an a way that is 
approachable and inviting. To do this, MakeCode uses the blocks programming model to let
the user learn coding concepts in a more tangible fashion. Once the user becomes comfortable
with the coding elements and structure, they can progress to create more complex programs. The blocks map directly to actual lines of code in a programming language. So, once a user has a sense of confidence and familiarity with how the blocks work, they can transition to coding more complex programs in the programming language itself.

MakeCode is not a universal programming platform but an extensible framework to create any
number of MakeCode based experiences customized to a specific _target_. These targets are typically maker-style or educational single board computers, but could also be a simulated only "soft" target. A list of MakeCode supported targets is at [MakeCode.com](https://makecode.com).

Target developers use the MakeCode framework and extend it by customizing the user 
interface and by adding additional blocks and functions specific to their hardware.

## MakeCode essentials

All of the parts of the MakeCode programming experience, when put toghether, create what's typically called an "editor". Even though MakeCode incorporates much more than just editors,
this concrete term is used more often, rather than referring to the MakeCode target as a "programming experience".

To describe the essentials of a MakeCode editor, it is combination of: a blocks editor, a language editor, a target simulator, and a target code generator.

### Blocks editor

The Blocks editor is where the user can interactively create a program by "pulling" or
"dragging" blocks onto the editor workspace. The blocks are found under the categories
available in the Blocks Toolbox aligning next to the workspace.

Blocks represent coding actions and programming structures that would traditionally be
written in text. Coding elements such as loops, conditonal statements, and events are
containing blocks with other blocks fitting inside. Functions and assignments are "flat"
blocks that fit into others. Variables, values, and properties are mini-blocks that fit into 
slots of functions, assignments, or evaluators.

![Blocks editor](/static/about/blocks-editor.png)

A single discrete block may have selectors for values or variables, and possibly slots for
values or parameters.

![Change block](/static/about/change-block.png)

### Language editor

A language editor complements the Blocks editor in MakeCode. When blocks are defined for
functions, statements, and assignments, the code matching them in the Language editor will represent the corresponding blocks in the
Blocks editor. In the Language editor, however, a user can write additional code with greater
complexity than what is available with blocks.

![JavaScript editor](/static/about/javascript-editor.png)

### Simulator

A simulator has visual elements that represent the functions of a target board. Developers
of a MakeCode target can add image items and code actions to simulate what happens when
the program is run on the board.

![Simulator](/static/about/simulator.png)

### Target code

When a program is ready for test or use on the target board, the user starts a download. In MakeCode, a download action will convert the code in the editor to the target's native format and generate a [HEX file](https://github.com/microsoft/uf2) to copy to the board. 

![Download button](/static/about/download-button.png)

The board appears as a file storage device connected to a user's computer. The HEX file is simply copied directly to this storage location.
A program loader already present on the board reads the HEX file. It flashes it into memory and then runs the new program.

![Download to board](/static/about/download-board.png)

## MakeCode and PXT

Microsoft MakeCode is based on the open source project [Microsoft Programming Experience Toolkit (PXT)](https://github.com/microsoft/pxt). The project is hosted as a public repository on [GitHub](https://github.com).

![PXT repository on GitHub](/static/about/pxt-repo.png)

### Language

MakeCode's underlying programming language 
is a subset of [TypeScript](http://typescriptlang.org)
called [Static TypeScript](/language), which omits the dynamic features of JavaScript.

### Features

The main features of [MakeCode](/docs) and its PXT implementation are:

* a [Google Blockly](https://developers.google.com/blockly/)-based code editor along with converter to [Static TypeScript](/language)
* a [Monaco](https://github.com/microsoft/monaco-editor)-based text editor with enhanced, robust auto-completion and auto-correction
* support to [define blocks](/defining-blocks) via annotated TypeScript or C++; try the [MakeCode Playground](/playground) to experiment with this feature
* markdown-based [documentation](/writing-docs) system with built-in macros to render block snippets
* a [command line interface](/cli)

## MakeCode targets

A MakeCode [target](https://makecode.com/target-creation) is a complete MakeCode editor developed for a particular board or target
platform. A functioning editor is built on top of, or inherits from, PXT. The target editor's code and resources are in a separate GitHub repository. 

![PXT and Target repos](/static/about/pxt-target.png)

### Extensions

Because of the extensiblity of PXT, [extension](https://makecode.com/extensions) projects can be created and published to add additional
blocks and other functionality to existing editors. The extensions simply plug into the 
editor while it's running, adding the new features.

![PXT, Target, and extension repos](/static/about/pxt-extension.png)

## Open Source

MakeCode is an open source project and is provided as a joint effort between [Microsoft Research](https://www.microsoft.com/en-us/research/project/microsoft-makecode/) and [Visual Studio](https://visualstudio.microsoft.com/).


## Contact us

Want to reach us? Get in touch using one of the resources on the [contact page](/contact).
