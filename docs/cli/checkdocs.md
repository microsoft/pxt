# pxt-checkdocs Manual Page

### @description Validates documentation

Validates the documentation looking for broken links or broken code snippets.

```
pxt checkdocs [--re foo]
```

## Description

This commands scans the documentation and perfoms various validation steps:
* checking for broken links,
* compiling and decompiling code samples
* ...

This command is also automatically run from a cloud build and will fail the build if any issue arises.

## Flags

### re path (optional)

Regex filter to select files to be scanned for snippets

## See Also

[pxt](/cli) tool
