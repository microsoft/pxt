# GitHub package authoring

**Posted on August 1, 2018 by [mmoskal](https://github.com/mmoskal)**

MakeCode has always been a platform with an easy block entry, even for middle-schoolers, but quite
high ceiling, allowing more advanced users to create complicated programs in [TypeScript](https://www.typescriptlang.org/).
Our [subset of TypeScript](https://makecode.com/language) supports most of regular TypeScript,
but can be efficiently compiled to run on very constrained devices like the micro:bit (your phone has
literally a million times more available memory than a micro:bit).
In fact, most of runtime libraries in our various editors is implemented in that Static TypeScript.
All the blocks are also defined there.
We also pack a [full-featured Monaco text editor](https://makecode.com/js/editor) in our web app.
Finally, since the very beginning, we allowed our editor to be extended by 
[user-provided packages](https://makecode.com/packages/getting-started) hosted on GitHub.
These packages can even introduce [their own user interface](https://makecode.com/packages/extensions) in the editor.
Packages [need to be approved](https://makecode.com/packages/approval) to surface in search but, unless they are banned,
can be loaded by providing an exact URL.

Until today, package authoring required usage of command line tools (`npm` and `git`, followed by required npm packages), 
which could be quite a road block for aspiring package writers.
Starting today, as the feature rolls out to various editors, you will be able to create packages and publish them to GitHub
directly from the web app, without ever touching command line or installing anything.

## Getting started

First, get a [GitHub account](https://github.com/join) if you don't have one yet.
GitHub is the largest host of source code in the world, with 30 million users.

Once you have your account, you will need to tie the MakeCode web app with your account.
To do that, open any project, go to the **Gear Wheel** menu on top, and select **Extensions**.
At the bottom, there should be a link to log in to GitHub. If there is no link in
your editor, try using it's `/beta` version.
A dialog will appear asking you to generate a GitHub token.
Follow the instructions and paste the token in the dialog.
This needs to be done separately for every editor you use, though in all of them you can
use the same token.

Once you have logged in, go back to the home screen. Now, the dialog that comes up after
you press the **Import** button will have an additional option to list your GitHub repositories
or create a new one.
Additionally, the **Import URL** option will now support `https://github.com/...` URLs,
which can be useful if you cannot find your repository in the list (especially for organizational
repos), or are just finding it faster to copy/paste the URL.

If you import a completely empty repo, or create a fresh one, MakeCode will automatically initialize
it with `pxt.json` and other supporting files.
If you import a non-empty repo without `pxt.json` file, you will be asked if you want it initialized.
Note that this might overwrite your files.

Currently, there is no way to push an existing project into GitHub. As a workaround, create a new project
and copy/paste the contents of the `main.ts` file.

## Commit and push

Once you have your repo set up, edit files as usual. Whenever you get to a stable state, or just every now and
then to keep history and insure against losing your work, push the changes to GitHub.
This is done with a little GitHub sync button on top of the **Explorer**.
The button will check if there are any pending changes to check in, if so will create a commit,
then it will pull the latest changes from GitHub, merge or fast-forward the commit
if needed, and push the results to GitHub.

If there are changes, you will be asked for a commit message. Try to write something meaningful, like
`Fixed temperature reading in sub-freezing conditions` or `Added mysensor.readTemperature() function`.
You can read history of these changes by following the version number link on the **Project Settings**
page.

When describing changes you are also given an option to bump the version number. This is a signal
that the version you're pushing is stable and the users should upgrade to it. When your package
is first referenced, the latest bumped version is used. Similarly, if there is a newer bumped
version there is a little upgrade button next to the package. Commits without bump will generally
not be accessible to most users, so they are mostly for you to keep track of things.

We do not really distinguish between, commit, push, and pull - it all happens at once in the sync operation.

There is also another button next to the GitHub sync - you can use it to add new files to the project.
This is mostly to help keep the project organized. For our TypeScript compiler it doesn't matter if you
use a single big file or a bunch of small ones.

### Conflicts

It may happen that several people edit the same package at once
causing edit conflicts.
It is also possible for the same person to edit the package using several
computers, browsers, or web sites, but in the description below for simplicity we'll concentrate on the case
of several people.

Typically, two people would sync a GitHub package at the same version,
and then they both edit it. The first person pushes the changes successfully.
When MakeCode will try to push the changes from the second person,
it will notice that these are changes against a non-current version.
It will create a commit based on the previous version and try to use the 
standard git merge (run server-side by GitHub).
This usually succeeds if the two people edited different files, or at least
different parts of the file - you end up with both sets of changes logically combined.
There is no user interaction required in that case.

If the automatic merge fails, MakeCode will create a new branch, push the commit
there, and then create a pull request (PR) on GitHub. The dialog that appears after this
happen will let you go to GitHub web site and resolve the conflicts.
Before you resolve conflicts and merge the PR, the `master` branch
will not have your changes (it will have changes from the other person, who
managed to commit first). After creating the PR, MakeCode moves your local
version to the `master` branch (without your changes).
After you resolve, sync again to get your changes as well.
MakeCode will also try to sync automatically when you close the PR dialog.

## Testing your package

To test blocks in your package, create a new project (regular, not on GitHub), and go
to the **Extensions** dialog. It will list all your GitHub projects as available
for import. Import it, and see how the blocks look like.

You can have one browser tab open with that test project, and another one with the package.
When you switch between them, they reload automatically.

You can test TypeScript APIs in the package itself. The `test.ts` file is only compiled
when the package is compiled directly, not when it's added to a different project.
You can put TypeScript test code in there.

## Non-packages

The GitHub feature is not limited to packages. You can also use it to store any other MakeCode projects.
You can even use it to collaborate on a project with multiple people.

Currently, any GitHub project will show up in your Extensions dialog though.

## Limitations

The web app will not let you create packages with C++. This you still need to do from command line, after installing
all required compilers or Docker (depending on target). The good news is that in our experience very few packages
contain C++ (mostly because TypeScript is easier to write, test, and in most cases sufficient).
The main reason we've seen so far for C++ packages was lack of floating point support on the micro:bit,
which [has now been fixed with the v1 release](https://makecode.com/blog/microbit/v1-beta).

## Random notes

You can use non-`master` branch by going to **Import URL** and saying something like `https://github.com/jrandomhacker/pxt-mypkg#mybranch`.
This wasn't tested very extensively.

MakeCode will generally only download files listed in `pxt.json`. Files in GitHub but not in `pxt.json` will be
ignored and left alone.

## Roll-out

The GitHub authoring feature is currently available in:
* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta), see [blog post](https://makecode.com/blog/microbit/v1-beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)
* The [BrainPad editor](https://makecode.brainpad.com)

Other editors will follow.
