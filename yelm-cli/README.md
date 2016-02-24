# yelm CLI

Yelm is a package manager. 

This NPM packages provides a command line interface to yelm.

### Package setup 

    yelm init my-package

`my-package` is package name. It has to be all lowercase, only letters, digits and dashed are allowed. You can then tweak `yelm.json` file.

`yelm init` creates appropriate `.gitignore` file, so to setup git (optional) you can just run:

    git init
    git add .
    git commit -m "Initial."

After setting up the packge, you can edit `main.ts` file. We recommend using VS Code as it provides good support for TypeScript.

### Building your package

`yelm build` will build the package. `yelm deploy` will build and try to copy the results to the device. `yelm` is an alias for `yelm deploy`.

### Name

Yelm is a city in Washington state, with a name short enough for a command line tool.

### More info

https://www.npmjs.com/package/yelm 

## License

MIT
