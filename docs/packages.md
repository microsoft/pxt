# Publishing packages

PXT packages contain functions and types and can be used by PXT projects.

PXT [targets](/target-creation) come with bundled packages, typically covering
core features of the target platform. 

You can also publish your own packages on GitHub. You will need to get a GitHub
account and create a GitHub repository. Let's say you want to create a package
called `neopixel` for target `microbit`.

* create GitHub repository `pxt-neopixel`
* clone this repository into `pxt-neopixel` folder
* go to the folder and run `pxt target microbit`; you can alternatively place the folder under 
  your target workspace where the target is already installed
* go to the cloned folder and run `pxt init`; follow the prompts
* edit `pxt.json` and `README.md` with the right descriptions
* checkin and push

Now, searching for `neopixel` after selecting `More -> Add package...` should bring up your
package.

## Meta-data

Make sure you keep the line `for PXT/microbit` in `README.md`. Otherwise
the package will not show up in search.

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
