# GitHub Extensions Authoring - Episode 2

**Posted on September 25, 2019 by [pelikhan](https://github.com/pelikhan)**

In the [previous "episode"](/blog/github-packages) of the GitHub authoring series, we introduce a simple way to host your MakeCode projects in GitHub. In this round of updates, we've integrated more GitHub features into MakeCode so that you don't have to jump between both web sites. Let's a look at these improvements:

## Create a GitHub repository from any project

So it started with a few blocks, but now your project is becoming big... Big enough that you want to host in a GitHub repository. To support this scenario, we have added a "create GitHub repository" button under the simulator.

![A 'create Github repository' button](/docs/static/blog/github-extensions-reloaded/createrepo.png)

The button pops a dialog that lets you pick a name, description, public or pivate and create the repository.

![A dialog to configure a GitHub repository](/docs/static/blog/github-extensions-reloaded/createrepodialog.png)

## GitHub status and editor

Once the project is associated to a GitHub repository, the ``create GitHub repository`` button becomes a status bar.
It shows you the GitHub project name (and branch if not master) and a up arrow if you have local changes.

![A github repository status](/docs/static/blog/github-extensions-reloaded/githubstatus.png)

Clicking on the status button opens a dedicated editor to handle all things related to GitHub.

![Properties of the github project](/docs/static/blog/github-extensions-reloaded/githubview.png)

## Diffing text

Whenever you are working on code, being able to see your changes is incredibly useful. It allows you to review them or maybe understand why the program does not work anymore. This kind of view is typically called a **diff** in the developer jargon. MakeCode now supports integrated diffing.

![A visual representation of changes in text](/docs/static/blog/github-extensions-reloaded/textdiff.png)


## Diffing blocks

We also added a new simplified diff for the blocks code. The diff shows 3 types of changes: added or modified blocks, deleted blocks or unmodified blocks.

![A visual representation of changes in blocks](/docs/static/blog/github-extensions-reloaded/blocksdiff.png)

## Reverting files

After reviewing your code chages using the diff views, you want decide that revert them to start over. This can now be done through the GitHub view.

![Revert each file in the project](/docs/static/blog/github-extensions-reloaded/revertbutton.png)

## Commit changes

Once you have reviewed all the changes, you are ready to commit and push your changes to GitHub.

![Commit changes button](/docs/static/blog/github-extensions-reloaded/commitchanges.png)

## Pulling changes

If you've made changes in another computer or you are working with other people on the same projects, changes are that you need to **pull** changes from GitHub. MakeCode will detect that changes are needed and will try to merge the changes in your project. If the merge fails, we might have to create a pull request or even fork the repository.

![Pull changes](/docs/static/blog/github-extensions-reloaded/pullchanges.png)

### ~ hint

This feature is NOT supported for block programs yet!

### ~


## Creating releases

When you have no local changes and your extension is ready to be used by others, it is a good time to create a release.
The new release dialog helps you with picking the right version number increment (without having to learn about semver).

![A semver friendly release dialog](/docs/static/blog/github-extensions-reloaded/pickrelease.png)

## Branches and pull requests

If you need to create a branch to work on a new feature, click on the ``#master`` text to create or switch to another branch.

![A branch switching dialog](/docs/static/blog/github-extensions-reloaded/branches.png)

If you are on a branch other than ``master``, the GitHub status and view will reflect that. You will also be able to open or review its **pull request**.

![A branch switching dialog](/docs/static/blog/github-extensions-reloaded/branchstatus.png)

## Roll-out

The GitHub authoring **reloaded** is currently available in:

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta)
* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)

## Feedback?

Drop us a note in the MakeCode forums at https://forum.makecode.com 
