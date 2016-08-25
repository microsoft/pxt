# Command Line Tool

PXT comes with a command line tool called, surprise, surprise, `pxt`. To use it, you need 
to first install [node.js](https://nodejs.org). Then, you can install `pxt` with `npm`
(you may need to use `sudo` on Linux or macOS):

```
npm install -g pxt
```

## Setting up workspace

For every PXT target you will need to create a directory for your projects.
Let's say you want to install `microbit` target, and name the directory `myworkspace`:

```
mkdir myworkspace
cd myworkspace
pxt target microbit
pxt serve
```

The last command will open default browser and point it to http://localhost:3232/

The `pxt target microbit` is conceptually the same as ``npm install pxt-microbit``
plus some housekeeping, like setting up `pxtcli.json` file to point to the target.

In future, you just need to run `pxt serve`. You can also run `npm update` to upgrade 
the target and PXT.

## Using the CLI

If you have created a PXT project from the web browser, you can go to its
folder (it will sit under `myworkspace/projects` but feel free to move it up one level)
and use the CLI to build and deploy it. 
* start with `pxt install`, which will install all required PXT packages
* use `pxt deploy` (or just `pxt`) to build and deploy the package to the device

You can edit the package using [VSCode](https://code.visualstudio.com/).

You can also [publish your own packages on GitHub](/packages).

## Cloud-keeping

The CLI tool is also used for configuring the PXT cloud service. Unless you have your
own PXT cloud you don't need to worry about it, otherwise [here are the docs](/cloudkeeping).
