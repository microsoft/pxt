# Target Creation

PXT is designed to provide a foundation for a customized target that you create with your own set of APIs and runtime. This is supported by PXT's Block-based, JavaScript, and Python code editing.

Targets extend the core components of the PXT platform to create a specialized coding experience adapted to programming [specific hardware](https://makecode.microbit.org) or a themed activity experience like [retro gaming](https://arcade.makecode.com).

![pxt-sample screenshot](/static/targets/sample/target-editor.png)
<br/>_Blocks editor for pxt-sample target_

### ~ hint

#### Examples of targets

Here's a list of some example targets based on the PXT platform.
<br/>

| Target | Sources |
|-|-|
| [Adafruit Circuit Playground](https://makecode.adafruit.com) | https://github.com/microsoft/pxt-adafruit |
| [MakeCode Maker](https://maker.makecode.com) | https://github.com/microsoft/pxt-maker |
| [pxt-sample](https://microsoft.github.io/pxt-sample/) | https://github.com/microsoft/pxt-sample |

### ~

## Prerequisites

A development environment is necessary before you get started. Familiarity with with Node.js, NPM, Git, JavaScript and/or C++ is assumed before starting the development of a target. Having Node.js and Git is necessary before you begin. Git might be already be installed as part your code editor but if not, you can [install](https://git-scm.com/) it separately. If you haven't done so yet, install [Node.js](https://nodejs.org).

### PXT install

Once your Node.js environment is in place, add the ``pxt`` [command line](/cli) tool.

```
npm install -g pxt
```

### Setup a base target

☑️ Setup a directory structure for your target files. Maybe something like:

```
mkdir pxt-dev
cd pxt-dev
```

☑️ Clone a copy of the [pxt-sample](https://github.com/microsoft/pxt-sample) target sources and open it in your favorite editor.

```
git clone https://github.com/microsoft/pxt-sample
```

☑️ Open a command prompt and, in the target folder, run this command to setup the additional tools used to build your target.

```
npm install
```

## Structure

The basic file structure for a target occupies a directory and the following folders:

```
/pxt-sample
    - /libs
    - /sim
    - /docs
    - /theme
    - pxtarget.json
    - package.json
    - targetconfig.json
```

**Note:** Later, you will replace the ``pxt-sample`` name with your target's project or repository name.

### Directories

* ``/libs``, extensions (sometimes referred to as libraries or packages) that define the APIs (in C++, Static TypeScript or Thumb assembler) and how they should be exposed in blocks
* ``/sim``, TypeScript source for the in-browser [simulator](/targets/simulator), if any
* ``/docs``, markdown documentation pages
* ``/theme``, styles for the target's theme

### Configuration files

* ``pxtarget.json``, contains the settings for the target's UI and basic blocks structure
* ``package.json``, the NPM module definition, settings, and dependencies
* ``targetconfig.json``, additional UI layout information

### Updating ``pxtarget.json``

The [pxtarget.json](/targets/pxtarget) file contains the configuration options of your target. 
For now, update the ``id``, ``name`` and ``title`` fields to reflect your target's information.
For the target ``id`` use only alphabetic characters as it will be used in various routing operations.

### ~ tip

#### Swap in your target name

In the ``pxtarget.json`` for ``pxt-sample``, search and replace all instances of ``sample`` with your target's name.

### ~

### Updating ``package.json``

Your target will eventually have to be published to NPM,
so go ahead and update the ``package.json`` file with your target id, 
repositories locations, etc.

☑️ Now is also a good time to check that your target id is available in NPM.

See the NPM documentation on [package.json](https://docs.npmjs.com/cli/configuring-npm/package-json) for more about which configuration details are placed in this file.

### Updating assets

Graphical assets are located under ``/docs/static``. At a minimum, you should have these images there:

* ``avatar.svg`` - image used in talking heads
* ``loader.svg`` - image used in loading overlay

### Home screen

Your home screen will have a banner and a recent projects list. Additional project or activity galleries are added in the ``targetconfig.json`` file.

![pxt-sample home screen](/static/targets/sample/home-screen.png)
<br/>_Home screen for pxt-sample target_

See the [home screen](/targets/home-screen) reference page for details on its configuration.

### Updating the ``core`` extension

The elements that provide the coding experience for the user are contained in target _extensions_. The APIs and Blocks exposed to the user are defined and implemented in extensions.

The `libs/core` extension of ``pxt-sample`` defines a *minimal* extension structure.

In the case of ``pxt-sample``, this target is only for the web. Its API implementation is actually in the `sim/api.ts` file (annotated to expose
[TypeScript functions as blocks](/defining-blocks)), The PXT compiler generates
the file `libs/core/sim.d.ts` from the simulator code in order to have the extension expose the APIs to the user.  

See [creating a PXT extension](/extensions)
for more information on authoring an extension, which includes code
in the extension itself.
For now, you can try adding a new API to one of the existing namespaces
in`sim/api.ts` with annotations to make a new block. 

### Adding a JavaScript library to your Sim

There are many useful JavaScript libraries that you might want to use in your target, especially
to make it easier to build the simulator (`sim/simulator.js`). The basic pattern to do this is:

☑️  Add the JavaScript file(s) to the directory `sim/public/js`.<br/>
☑️  Include these files in `sim/public/simulator.html` using the `<script>` tag.

### Exposing a JavaScript library to TypeScript and Blockly

If you want to make JavaScript functions (from an existing library) available to 
the user of your target (via TypeScript and Blockly), there's more work to do. You
will need to write TypeScript functions to wrap the existing JavaScript functions.
Some JavaScript libraries may already have a TypeScript declaration file available,
which can make the process simpler. 

### Updating the ``templates`` projects

Templates are the default projects for your target. 
There is one default blocks project, and one default JavaScript project.
The initial templates are empty projects.
To change the default project, modify the extension under ``libs/blocksprj``

### Testing the target locally

Now that you've updated your target, it is ready to be run locally. Run the following command:

```
pxt serve
```

This will run all the build steps for the target and start a local web server to host it.
The editor will automatically open the target API project which you can edit directly in PXT. 
At this point, we recommend to create a new project using blocks that will serve as a sandbox. 
New projects are created under the ``/projects`` folder when testing a target locally (and are automatically "git-ignored"). You can use these projects to change your templates. Simply copy the contents of your project under ``/projects`` to one of the templates under ``/libs/templates/``.

Whenever you make a change, the local web server will trigger a build. Simply reload the page once the build is done.

## Defining APIs and Blocks

The APIs available in the PXT environment are loaded from TypeScript extension (library) files
(the ones under ``/libs``). 
They can optionally be [auto-generated](/simshim) from C++ library files or from TypeScript
simulator files.

Read more about [how to annotate your APIS](/defining-blocks) to expose them as blocks in PXT.

## Path rewriting

When uploading to PXT cloud URLs of various files are rewritten to ones pointing to the CDN.
There are three kinds of URLs on the CDN:

* `/blob/<blob_hash>/some/path/filename.ext` - where the path and file name can be arbitrary
* `/commit/<commit_hash>/path/in/that/commit/filename.ext` - where the path actually comes from the commit
* `/tree/<tree_hash>/path/in/that/tree/filename.ext` - where the path actually comes from the tree

Whenever possible, `/blob/` URLs should be used, since they only change when the file changes.
This allows for faster app updates.

For an example, compare https://makecode.microbit.org/---manifest
and https://github.com/microsoft/pxt/blob/master/webapp/public/release.manifest

Generally, PXT will rewrite URLs starting with `/cdn/` to `/commit/...` and ones starting
with `/blb/` to `/blob/...`. This happens in manifest and HTML files, as well as some JavaScript
files (web worker sources and `embed.js`). Part of that rewriting happens client-side when uploading
(strings like `@commitCdnUrl@` and `@blobCdnUrl@` are introduced), and part happens in the cloud.

Currently, in simulator files only, all of `/cdn/`, `/sim/` and `/blb/` are rewritten
to `/blob/...`. Going forward however, simulator files should use `/blb/` explicitly
to make the intent clear.

The main reason to use `/cdn/` instead of `/blb/` is when resources require relative paths.
This is for example the case for Blockly media files.

The `/tree/...` URLs are not yet supported in rewriting.
