# GitHub Extensions Authoring - Episode 2

**Posted on September 25, 2019 by [pelikhan](https://github.com/pelikhan)**

## ~ hint

**Update**: Read part 3 at [MakeCode with GitHub](/blog/makecode-with-github).

## ~


In the [previous "episode"](/blog/github-packages) of the GitHub authoring series, we introduced a simple way to host your MakeCode projects on GitHub. In our latest round of updates, we've integrated more GitHub features into MakeCode which let you stay right where you are without having to jump between both web sites. Let's a look at these improvements:

## Create a GitHub repository from any project

https://youtu.be/GQ8SV7gS4Bg

So it started with a few blocks, but now your project is becoming big...so big, that you want to host in a GitHub repository. To support this scenario, we have added a "create GitHub repository" button under the simulator.

![A 'create Github repository' button](/static/blog/github-extensions-reloaded/createrepo.png)

The button pops a dialog that lets you pick a name, give a description, set as public or private, and then create the repository.

![A dialog to configure a GitHub repository](/static/blog/github-extensions-reloaded/createrepodialog.png)

## GitHub status and editor

Once the project is associated to a GitHub repository, the ``create GitHub repository`` button becomes a status bar.
It shows you the GitHub project name (and the branch if it's not **master**) and an up arrow if you have local changes.

![A github repository status](/static/blog/github-extensions-reloaded/githubstatus.png)

Clicking on the status button opens a dedicated editor to handle all things related to GitHub.

![Properties of the github project](/static/blog/github-extensions-reloaded/githubview.png)

## Diffing text

Whenever you are working on code, being able to see your changes is incredibly useful. It allows you to review those changes or maybe understand why the program does not work anymore. This kind of view is typically called a **diff** in developer jargon. MakeCode now supports integrated diffing.

![A visual representation of changes in text](/static/blog/github-extensions-reloaded/textdiff.png)


## Diffing blocks

We also added a new simplified diff for the blocks code. The diff shows 3 types of changes: added or modified blocks, deleted blocks, or unmodified blocks.

![A visual representation of changes in blocks](/static/blog/github-extensions-reloaded/blocksdiff.png)

## Reverting files

After reviewing your code changes using the diff views, you might decide that you want to revert them and start over. This can be done in the GitHub view also.

![Revert each file in the project](/static/blog/github-extensions-reloaded/revertbutton.png)

## Commit changes

Once you have reviewed all the changes, you're ready to commit and push your changes to GitHub.

![Commit changes button](/static/blog/github-extensions-reloaded/commitchanges.png)

## Pulling changes

If you've made changes on another computer, or you are working with other people on the same projects, chances are that you need to **pull** other changes from GitHub. MakeCode will detect that you need these changes and will try to merge the them into your project. If the merge fails, we might have to create a pull request or even fork the repository to accomodate the situation.

![Pull changes](/static/blog/github-extensions-reloaded/pullchanges.png)

### ~ hint

This feature is NOT supported for block programs yet!

### ~


## Creating releases

Once you have no remaining local changes and your extension is ready for use by others, it is a good time to create a release.
The new release dialog helps you pick the right version number increment (saves you from having to go learn how to use [semver](https://semver.org/)).

![A semver friendly release dialog](/static/blog/github-extensions-reloaded/pickrelease.png)

## Branches and pull requests

If you need to create a branch to work on a new feature, click on the ``#master`` portion of the branch path to create or switch to another branch.

![A branch switching dialog](/static/blog/github-extensions-reloaded/branches.png)

If you are on a branch other than ``master``, the GitHub status and view will reflect that. You will also be able to open or review its **pull request**.

![A branch switching dialog](/static/blog/github-extensions-reloaded/branchstatus.png)

## Roll-out

The new GitHub authoring **reloaded** feature is currently available in:

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta)
* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)

## Feedback?

Drop us a note in the MakeCode forums at https://forum.makecode.com 
