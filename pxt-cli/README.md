# Programming Experience Toolkit CLI

This package provides `pxt` command line tool.

### Package setup 

    pxt init my-package

`my-package` is package name. It has to be all lowercase, only letters, digits and dashed are allowed. You can then tweak `pxt.json` file.

`pxt init` creates appropriate `.gitignore` file, so to setup git (optional) you can just run:

    git init
    git add .
    git commit -m "Initial."

After setting up the packge, you can edit `main.ts` file. We recommend using VS Code as it provides good support for TypeScript.

### Building your package

`pxt build` will build the package. `pxt deploy` will build and try to copy the results to the device. `pxt` is an alias for `pxt deploy`.

### More info

https://www.npmjs.com/package/pxt-core

## License

MIT
