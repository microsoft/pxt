## Building your own package

### Step 0: Local server setup

In order to build and test your package locally, you need to setup PXT to run locally.
Follow the [instructions on setting up workspace](/cli#setting-up-workspace).

### Step 1: GitHub setup

You will need to get a [GitHub](https://github.com) account and create a GitHub repository. 

Let's say you want to create a package called `banana` for target `TARGET`.

* create (do not clone) a fresh GitHub repository `pxt-banana`
* clone this repository into `pxt-banana` folder under the `myworkspace` or subfolder thereof
* go to the cloned folder and run `pxt init`; follow the prompts
* edit `pxt.json` and `README.md` with the right descriptions
* commit files to git: `git add .`, and commit them: `git commit -m "Initial"`

> **Make sure you keep the line `for PXT/TARGET` (where `TARGET` is the target id) in `README.md`. Otherwise the package will not show up in search.**

### Step 2: Developing package

Now, you're ready to develop your package. You can do it with [VSCode](https://code.visualstudio.com/)
or from the web editor served from `pxt serve`.

* put the contents of your package in `main.ts`
* add sample program using the package in `test.ts`
* use `pxt` to build and deploy the package with tests; use the web editor to test in the simulator

### ~ hint

If the local editor fails to open, copy the URL printed in the console and open it in your favorite browser. 
The local server requires a security token embedded in the URL to serve pages.

### ~

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

### Step 4: Publishing your package

When you're happy with the first version of your package commit the changes and
bump the version and push to github:

```
git commit -a -m "Amazing flying bananas"
pxt bump
```

The `pxt bump` will make sure there are no uncommited changes, bump the version number,
create a git tag, and push everything to github.

In the editor, paste the full URL to your repo after selecting `More -> Add package...`. Your package should show up.

### Step 5: Approval

In order to be searchable by users, packages need to be approved. GitHub organizations or individual repos can be approved.
See [approval](/packages/approval) for more details.

### ~ hint

**Make sure you keep the line `for PXT/TARGET` (where `TARGET` is the target platform id) 
in `README.md`. Otherwise the package will not show up in search.**

### ~

Read more on [defining-blocks](https://makecode.com/defining-blocks) to learn how to surface your APIs into blocks and JavaScript.

### Icon

The editor will automatically use any ``icon.png`` file when displaying the package in the editor. **This feature only works for approved packages.**

The icon should be sized with a 16:9 ratio and of at least ``184`` pixel wide.
