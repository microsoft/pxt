# pxt-install Manual Page

### @description Copy extensions to pxt_modules folder

Copies all built-in and external extensions to `pxt_modules` folder.

```
pxt install [--link FOLDER] 
```

## Options

### --link

For every extension installed, if it's present in FOLDER, link it, instead
of copying.
This uses `additionalFilePath` feature of `pxt.json`.

## See Also

[pxt](/cli) tool
