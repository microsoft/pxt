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

If you import a completely empty repo, or create a new one, MakeCode will automatically initialize
it with `pxt.json` and other supporting files.
If you import a non-empty repo without `pxt.json` file, you will be asked if you want it initialized.
Note that this might overwrite your files.


## Limitations

The web app will not let you create packages with C++. This you still need to do from command line, after installing
all required compilers or Docker (depending on target). The good news is that in our experience very few packages
contain C++ (mostly because TypeScript is easier to write, test, and in most cases sufficient).
The main reason we've seen so far for C++ packages was lack of floating point support on the micro:bit,
which has [now been fixed with the v1 release](https://makecode.com/blog/microbit/v1-beta).

## Roll-out

The GitHub authoring feature is currently available in:
* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta), see [blog post](https://makecode.com/blog/microbit/v1-beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)
* The [BrainPad editor](https://makecode.brainpad.com)

Other editors will follow.
