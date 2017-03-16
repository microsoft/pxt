# Testing

## Automated testing

Run `pxt snippets` in the project's root directory. This will automatically check that all code
snippets in your documentation can be compiled, and it will check that no typescript features 
that cannot be represented as blocks are used in block snippets.

If you use an additional dependencies, make sure you reference them (see [Anchors](/writing-docs/anchors#dependencies)). 

To ensure that a snippet isn't checked, add `-ignore` after the snippet type (see [Macros](/writing-docs/macros#ignore)).