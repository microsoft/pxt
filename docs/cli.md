# Command Line Tool

PXT comes with a command line tool called, surprise, surprise, `pxt`. To use it, you need 
to first install [node.js](https://nodejs.org). Then, you can install `pxt` with `npm`
(you may need to use `sudo` on Linux or macOS):

```
npm install -g pxt
```

### ~ hint

If you are building pxt-microbit on Windows, make sure the following are installed:

1. [Yotta (follow manual install for Windows)](http://docs.yottabuild.org/#installing-on-windows)
2. [SRecord 1.64](https://sourceforge.net/projects/srecord/files/srecord-win32/1.64/) and move it to ``` C:\```
3. [Visual Studio and/or the C++ toolchains](https://www.visualstudio.com/downloads/)

Also, make sure you add these to your Path:
```
C:\Python27\Scripts
C:\srecord_dir
```

### ~

## Setting up a workspace

For every PXT target (editor) you will need to create a directory for your projects.
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
folder (it will sit under `projects`) and use the CLI to build and deploy it. 

* start with `pxt install`, which will install all required PXT packages
* use `pxt deploy` (or just `pxt`) to build and deploy the package to the device

You can edit the package using [VSCode](https://code.visualstudio.com/)
and publish it on GitHub. 

While it is true that you can use any editor for editing TypeScript code, you might consider using VSCode as you are learning the language, as it provides syntax highlighting, linting, and other support that could save you time in debugging your extensions.

### Creating a new project

Open a shell to your ``microbit`` folder.

```
# create a new subfolder for your project
cd projects
mkdir blink
cd blink
# start the project set
pxt init
# open VSCode
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

Run ``pxt help`` for the list of all commands. The following list of links contains more info on specific commands.

* [target](/cli/target), downloads the editor tools
* [build](/cli/build), builds the current project
* [deploy](/cli/deploy), builds and deploys the current project
* [console](/cli/console), monitors ``console.log`` output
* [bump](/cli/bump), increment the version number
* [checkdocs](/cli/checkdocs), validates the documentation links and snippets
* [staticpkg](/cli/staticpkg), compiles editor into flat file system

## Debugging Commands

* [gdb](/cli/gdb), attempt to start OpenOCD and GDB
* [serial](/cli/serial), monitor UART ``serial.writeLine(...)`` from certain boards
* [hidserial](/cli/hidserial), monitor ``console.log(...)`` from certain boards
* [hiddmesg](/cli/hiddmesg), fetch ``DMESG`` buffer over HID and print it

## Advanced Commands

* [serve](/cli/serve), run local server
* [pyconv](/cli/pyconv), convert MicroPython code into Static TypeScript.
* [update](/cli/update), updates the ``pxt-core`` dependency and runs installation steps
* [buildsprites](/cli/buildsprites), encode sprite images into a ``jres`` resource
* [login](/cli/login), store a GitHub token
