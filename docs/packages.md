# Packages

PXT packages contain functions and types and can be used by PXT projects. 
Packages can be searched by the users and added in their projects. 
Packages may contain a combination of JavaScript and C++ and expose their APIs as blocks and/or JavaScript functions.

## Using packages

In the web editor, click on ``More`` then ``Add Package`` to search and add packages to the project.
The Blocks and JavaScript definitions will be automatically loaded in the editor.

## Building packages

This is a section for advanced users who want to publish their own package.

### Step 1: Local server setup

In order to build and test your package locally, you need to setup PXT to run locally.
Follow the instructions on [PXT README.md](https://github.com/Microsoft/pxt/blob/master/README.md#running-a-target-from-localhost) file.

### Step 2: GitHub setup

You will need to get a [GitHub](https://github.com) account and create a GitHub repository. 

Let's say you want to create a package called `banana` for target `microbit`.

* create GitHub repository `pxt-banana`; do not clone an existing package, as it will not show up in search
* clone this repository into `pxt-banana` folder **under the `projects`**
* go to the cloned folder and run `pxt init`; follow the prompts
* still in the cloned folder, run `pxt install` to install dependent packages
* edit `pxt.json` and `README.md` with the right descriptions

> **Make sure you keep the line `for PXT/TARGET` (where `TARGET` is the target id) in `README.md`. Otherwise
the package will not show up in search.**

In the editor, searching for `banana` after selecting `More -> Add package...` should bring up your
package.

### Step 3: Testing

In order to test your package, you will manually add a reference to the package on disk.

* Open the local editor and create a new project.
* Open the project properties (``More`` -> ``Project Properties``)
* Click on ``Edit Settings As Text``
* Add an entry under ``dependencies`` that points to your package folder:

```
{
    "name": "banana test",
    "dependencies": {
        ...
        "banana": "file:../pxt-banana"
    },
    ...
}
```

* Reload the editor and your package blocks will be loaded.

### Step 4: publish

Once your changes are ready, publish them to GitHub. Users will be able to search for your package.

## Meta-data

**Make sure you keep the line `for PXT/TARGET` (where `TARGET` is the target id) in `README.md`. Otherwise
the package will not show up in search.**

Read more an [defining-blocks](/defining-blocks) to learn how to surface your APIs into blocks and JavaScript.

## Versioning

When someone references your package from the web UI they will get
a specific version.

If you have any tags, PXT will pick the one with
the highest [Semantic Version](http://semver.org) precedence (the biggest version
number). Thus, it's good to have tags like `v0.0.0`, `v0.1.7-rc.4` etc.

If there are no tags, PXT will pick the latest commit from the default branch
(usually `master`).

In both cases, the specific version is hard-coded into the user's package.
To update, the user has to take explicit action (currently remove and re-add the package).

You can use `pxt bump` to bump version of a package. It will `git pull`, update the patch
version level (but will ask you for an override), create a git tag and push.

## Samples

* https://github.com/Microsoft/pxt-neopixel
* https://github.com/Microsoft/pxt-i2c-fram

Be aware that if you just fork one of these, the **fork won't show up in search**.
You have to create a new repo.
