# Saving projects

The programs your create in MakeCode are saved as projects to your browser's local storage. Your program is saved as a project whether you choose to save it with a name or not. If you don't save it as a named project, it stays in local storage as an "Untitled" project.

At the bottom of the editor window is a save project box with a place to type a name and a disk button you press to save the current project with that name.

## What's in a project?

The basic parts of a project are four files:

* _main.ts_
* _main.blocks_
* _README.md_
* _pxt.json_

These files contain the JavaScript source code, the attributes and positions of the blocks, and dependency information.

## Storage location and persistance

The project files are actually stored as data in the browser's indexed data store. The project data is keyed from an identifier associated with the project and the [MakeCode](@homeurl@) web site URL. The data store doesn't keep the project data forever. It's subject to removal by a user when they decide to clear the browser's cache and temporary files. Rules for how browsers clear should their cache and data store are specified by [W3C Clear Site Data](https://www.w3.org/TR/clear-site-data/) policy.
