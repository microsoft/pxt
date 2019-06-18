# GitHub package authoring

**Posted on August 1, 2018 by [mmoskal](https://github.com/mmoskal)**

## ~ hint

**Update**: This feature is now documented in [GitHub extension authoring](/extensions/github-authoring).

## ~

MakeCode is a platform with an easy level of entry, even for middle-schoolers, but allowing nearly unlimited creativity and complexity available to advanced users for writing programs in [TypeScript](https://www.typescriptlang.org/). Our [subset of TypeScript](https://makecode.com/language) supports most of the regular language features of TypeScript, but can be efficiently compiled to run on extremely resource constrained devices like the micro:bit (your phone literally has a _million times_ more available memory than a micro:bit!). In fact, most of the runtime libraries in our editors are implemented in Static TypeScript including all of the defined blocks. We also pack a [full-featured Monaco text editor](https://makecode.com/js/editor) into our web app.

From the very beginning, we allowed extensions to our editor with [user-provided packages](/extensions/getting-started) hosted on GitHub. These packages can even introduce [their own user interface](/extensions/extensions) in the editor. Packages first need [approval](/extensions/approval) to surface in search but, unless they are banned, can be loaded without approval by providing an exact URL.

Until now, package authoring required usage of command line tools (`npm` and `git`, along with the required npm packages), which could present quite a barrier to aspiring package writers. Starting today, as the feature rolls out to various editors, you will be able to create packages and publish them to GitHub directly from the web app, without ever touching command line or installing anything.

## Let's do it!

First, you need a [GitHub account](https://github.com/join) if you don't have one yet. GitHub is the largest host of source code in the world, with over 30 million users.

Once you have your account, you'll need to tie the MakeCode web app to your account. To do that, open any project, go to the **Gear Wheel** menu on top, and select **Extensions**. At the bottom, there should be a link to log in to GitHub. If there's no link in your editor, try using its `/beta` version. A dialog will appear asking you to generate a GitHub token. Follow the instructions and paste the token into the dialog. You'll need to paste in a token again for each editor you use (micro:bit, Circuit Playground, etc.), though you can use the same token for all of them.

Once you've logged in, go back to the home screen. Now, the dialog that comes up after you press the **Import** button will have an additional option to list your GitHub repositories or create a new one.
Additionally, the **Import URL** option will now support `https://github.com/...` URLs, which is useful if you can't find your repository in the list (especially organizational repos), or as way to search the list faster using a copy/paste of the URL.

![Repo list dialog](/static/blog/github-packages/repo-list.png)

If you import a completely empty repo, or create a fresh one, MakeCode will automatically initialize it with `pxt.json` and other supporting files. If you import a non-empty repo without the `pxt.json` file, you will be asked if you want it initialized. Note that this might overwrite your existing files.

![Repo create dialog](/static/blog/github-packages/repo-create.png)

Currently, there is no way to push an existing project into GitHub. As a workaround, create a new project
and copy/paste the contents of the `main.ts` file.

## Commit and push

Once you have your repo set up, edit files as usual. Whenever you get to a stable state, or just every now and
then to keep history and insure against losing your work, push the changes to GitHub. This is done with a little GitHub sync button on top of the **Explorer**. The button will check if there are any pending changes to check in. If there are, it will create a commit, pull the latest changes from GitHub, merge or fast-forward the commit if needed, and push the results to GitHub.

![Repo sync button](/static/blog/github-packages/repo-sync.png)

If there are changes, you will be asked for a commit message. Try to write something meaningful, like
`Fixed temperature reading in sub-freezing conditions` or `Added mysensor.readTemperature() function`.

When describing changes, you are also given an option to bump the version number. This is a signal that the version you're pushing is stable and the users should upgrade to it. When your package is first referenced, the latest bumped version is used. Similarly, if there is a newer bumped version, a little upgrade button will appear next to the package. Commits without bump are generally not accessible to most users, so they are mostly for you to keep track of things.

![Repo commit dialog](/static/blog/github-packages/repo-commit.png)

We do not really distinguish between a commit, push, and pull - it all happens at once in the sync operation.

You can view a history of changes by following the version number link on the **Project Settings** page.

![Repo view link in project settings](/static/blog/github-packages/repo-view.png)

There is also another button next to the GitHub sync - you can use it to add new files to the project.
This is mostly to help keep the project organized. For our TypeScript compiler it doesn't matter if you
use one big file or a bunch of smaller ones.

### Conflicts

It's possible that multiple people are editing the same package at the same time causing edit conflicts. This is similar to the situation where the same person edits the package using several computers, browsers, or web sites. In the conflict description below, for simplicity, we'll just concentrate on the case of multiple people working on the same package.

Typically, two people would sync a GitHub package at the same version, and then they both edit it. The first person pushes the changes successfully. When MakeCode tries to push the changes from the second person,
it will notice that these are changes against a non-current version. It will create a commit based on the previous version and try to use the standard git merge (run server-side by GitHub). This usually succeeds if the two people edited different files, or at least different parts of the file - you end up with both sets of changes logically combined. There is no user interaction required in that case.

If the automatic merge fails, MakeCode will create a new branch, push the commit there, and then create a pull request (PR) on GitHub. The dialog that appears after this happens will let you go to the GitHub web site and resolve the conflicts. Before you resolve conflicts and merge the PR, the `master` branch will not have your changes (it will have changes from the other person, who managed to commit first). After creating the PR, MakeCode moves your local version to the `master` branch (without your changes), but don't despair they are not lost! Just resolve the conflict in GitHub and sync to get all changes back. MakeCode will also sync automatically when you close the PR dialog (presumably, after you resolved the conflict in another tab).

## Testing your package

To test blocks in your package, press the **New Project** button on the home screen and go to the **Extensions** dialog. It will list all your GitHub projects as available for addition. Select your package and see what the blocks look like.

You can have one browser tab open with that test project, and another one with the package. When you switch between them, they reload automatically.

For testing TypeScript APIs you don't need a separate project, and instead can
use the `test.ts` file in the package itself. It is only used when you run the package
directly, not when you add it to a project. You can put TypeScript test code in there.

## Non-packages

The GitHub feature is not limited to packages. You can also use it to store other MakeCode projects.
You can even use it to collaborate on a project with multiple people.

Currently, any GitHub project will show up in your **Extensions** dialog though.

## Limitations

The web app will not let you create packages with C++. This you still need to do from command line, after installing all required compilers or Docker (depending on target). The good news is that in our experience very few packages contain C++ (mostly because TypeScript is easier to write, test, and in most cases sufficient). The main reason we've seen so far for needing C++ packages was the lack of floating point support on the micro:bit, which [is now fixed with the v1 release](https://makecode.com/blog/microbit/v1-beta).

## Random notes

You can use a non-`master` branch by going to **Import URL** and saying something like `https://github.com/jrandomhacker/pxt-mypkg#mybranch`. User note, this hasn't been extensively tested yet.

MakeCode will generally only download files listed in `pxt.json`. Files in GitHub but not in `pxt.json` will be ignored and left alone.

## Roll-out

The GitHub authoring feature is currently available in:

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta), see [blog post](https://makecode.com/blog/microbit/v1-beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)
* The [BrainPad editor](https://makecode.brainpad.com)

Other editors will follow.
