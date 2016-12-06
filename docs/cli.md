# Command Line Tool

PXT comes with a command line tool called, surprise, surprise, `pxt`. To use it, you need 
to first install [node.js](https://nodejs.org). Then, you can install `pxt` with `npm`
(you may need to use `sudo` on Linux or macOS):

```
npm install -g pxt
```

## Setting up workspace

For every PXT target you will need to create a directory for your projects.
Let's say you want to install `microbit` target, and name the directory `microbit`:

```
mkdir microbit
cd microbit
pxt target microbit
pxt serve
```

The last command will open the editor in your default browser.

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

### Creating a new project

Open a shell to your ``microbit`` folder.

```
# create a new subfolder for your project
cd projects
mkdir blink
cd blink
# start the project set
pxt init
# open code
code .
```

### Opening an existing project 

You can extract a project from the embedded URL or .hex file. Open a shell to your projects folder

```
# extract the project from the URL
pxt extract EMBEDURL
```
where ``EMBEDURL`` is the published project URL.

## Commands

* [build](/cli/build), builds the current project
* [deploy](/cli/deploy), builds and deploys the current project
* [login](/cli/login), store a GitHub token
