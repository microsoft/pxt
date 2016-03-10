# KindScript CLI

This package provides `kind` command line tool.

### Package setup 

    kind init my-package

`my-package` is package name. It has to be all lowercase, only letters, digits and dashed are allowed. You can then tweak `kind.json` file.

`kind init` creates appropriate `.gitignore` file, so to setup git (optional) you can just run:

    git init
    git add .
    git commit -m "Initial."

After setting up the packge, you can edit `main.ts` file. We recommend using VS Code as it provides good support for TypeScript.

### Building your package

`kind build` will build the package. `kind deploy` will build and try to copy the results to the device. `kind` is an alias for `kind deploy`.

### More info

https://www.npmjs.com/package/kindscript

## License

MIT
