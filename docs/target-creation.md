# Target Creation

PXT is built to allow targeting different coding environment, called **targets**. 
In this page, we'll go through the steps necessary to get your target with your own blocks and runtime.

Since this is a rather technical topic, we assume that the reader is familiar with Node.JS, NPM
and JavaScript and/or C++.

A target contains the following folders:

* ``/libs``, packages that define the JavaScript and APIs and how they should be exposed in blocks.
* ``/sim``, TypeScript source for the in-browser simulator (if any).
* ``/docs``, markdown documentation pages

## Getting started

* If you haven't do so yet, instal Node.JS and the **PXT** command line

```
npm install -g pxt
```

* Get a copy of the [sample target sources](https://github.com/microsoft/pxt-sample) and open it in your favorite editor.
* Open a command prompt in the target folder and run these commands to setup the tools.

```
npm install
```

At this point, pick a identifier for your target. Use only alphanumeric characters as it will be used in various routing operations.

### Updating ``package.json``

Your target will eventually have to be published to NPM so go ahead and update the ``package.json`` file with your target id, repositories locations,
etc...
* it might be a good time to check that your target id is available in NPM as well.

### Updating ``pxtarget.json``

The ``pxtarget.json`` file contains the configuration options of your target. We'll talk about it deeply later. For now, update
the ``id``, ``corpkg``, ``name`` and ``title`` fields to reflect your target information.

* Tip: keep searching and replacing all instances of ``sample`` in `pxtarget.json`.

### Updating the ``sample`` package

* Rename the ``/libs/sample`` project to your target id, ``libs/[your target id]``
* open ``pxt.json`` under that folder and rename ``id`` field value to your target id.

### Testing the target locally

Now that you've updated your target, it is ready to be run locally. Run the following command:

```
pxt serve
```

The editor will automatically open the target API project which you can edit directly in PXT. 
At this point, we recommend to create a new project using blocks that will serve as a sandbox. 
New projects are created under the ``/projects`` folder when testing a target locally (and are automatically "git-ignored").

Whenever you make a change, the local web server will trigger a build. Simply reload the page once the build is done.

## Defining APIs and Blocks

The APIs available in the PXT environment are loaded export TypeScript or C++ declarations from the package.

Read more about [how to annotate your APIS](/defining-blocks)
to expose them in PXT.

## Simulator



## Compilation to ARM native code

If your target platform is ARM Mbed compatible, PXT will be able to compile programs to ARM machine code in browser.
We recommend to contact the team to help you get started on this topic.
