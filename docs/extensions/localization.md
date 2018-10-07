# Extension localization files

Extensions can contain localized strings in JSON resource files. This page describes, in detailed steps, how to localize an extension.

## Overview

### Preparation

1. [Install NodeJS](#1-install-nodejs)
2. [Install the PXT command-line tool](#2-install-the-pxt-command-line-tool)

If translating someone else's extension from GitHub:

3. [Fork the extension's repo in GitHub](#3-fork-the-extension-repo-in-github)
4. [Clone your fork to your computer](#4-clone-your-fork-to-your-computer)

### Translating

1. [Prepare the extension for building](#1-prepare-the-extension-for-building)
2. [Extract the strings](#2-extract-the-strings)
3. [Create the translations](#3-create-the-translations)
4. [Add the translation files to the extension configuration](#4-add-the-translation-files-to-the-extension-configuration)

### Testing your translations

1. [Clone the target repo](#1-clone-the-target-repo)
2. [Install the target](#2-install-the-target)
3. [Bundle your extension with the target](#3-bundle-your-extension-with-the-target)
4. [Serve the target](#4-serve-the-target)
5. [Launch the local editor](#5-launch-the-local-editor)
6. [Add your extension to a project](#6-add-your-extension-to-a-project)

### Committing your translations to the extension repo

If you're not the author of the extension you're translating, you'll need to ask them to merge your translations into their repo.
1. [Push your changes to your fork](#1-push-your-changes-to-your-fork)
2. [Create a pull request in the extension repo](#2-create-a-pull-request-in-the-extension-repo)

----
## Step by step instructions

Follow each of these steps to prepare your environment, create a translation, test, and then submit the translation files.

### Preparation

#### 1. Install NodeJS

- Go to https://nodejs.org/en/download/
- Download and run the "LTS" installer for your platform

![](/static/images/download-node-js.png)

#### 2. Install the PXT command-line tool

- Open a command prompt and run `npm install -g pxt`

#### 3. Fork the extension repo in GitHub

You only need to do this if you are not the author of the extension you are translating.

- Find the extension you wish to translate on GitHub, for example [the motor:bit](https://github.com/Tinkertanker/pxt-motorbit)
- Click the "Fork" button in the top-right

![](/static/images/github-fork.png)

- When asked where to put the fork, just choose your username

#### 4. Clone your fork to your computer

- In the command prompt, navigate to a folder where you wish to download the extension fork
- Run `git clone https://github.com/[your username]/[the repo name]`
>   For example, `git clone https://github.com/myGithubAccount/pxt-motorbit`

### Translating

#### 1. Prepare the extension for building

- In the command prompt, navigate to the directory where the extension is (or to your fork, if you're translating someone else's extension)
- Run `pxt target [target]`, for example `pxt target microbit` if the extension is for the micro:bit
- Run `pxt install`

#### 2. Extract the strings

- Run `pxt gendocs --locs`

This will create a `_locales` folder in the root of the extension.
In that folder, you'll find various `.json` files. These files contain the strings to translate.

#### 3. Create the translations

- Under the `_locales/` folder, create a new folder and name it the ISO code for the language you want to translate to
>   For example, `_locales/fr/` for French, `_locales/es/` for Spanish, etc.
- Copy all the `.json` files under `_locales/` and paste them into your new language folder
- Open the `.json` files from under your language folder and edit the string values inside them
>   The files are in the following format:

```
{
    "string id": "string value"
}
```

>    - To translate the strings, change the string values (inside the `" "` after the `:`)
>    - Be careful not to remove the special characters, such as `%`, `|`, etc. These characters are parsed by our editor to generate the blocks.
>>For example, `"motorbit.turnleft|block": "turn left with speed %n"` would become `"motorbit.turnleft|block": "tourner à gauche avec vitesse %n"` in French.

#### 4. Add the translation files to the extension configuration

Once you're done editing the `.json` files, you must add them to the extension configuration so that our editor recognizes them.
- In the extension root, open the file `pxt.json`
- Find the `"files": [...]` entry, it will look something like:

```
"files": [
    "README.md",
    "neopixel.ts"
],
```

- Add your files to the list by including their relative path from the root of the extension
>For example, if you translated to JA and ZH:

```
"files": [
    "README.md",
    "neopixel.ts"
    "_locales/ja/neopixel-strings.json",
    "_locales/ja/neopixel-jsdocs-strings.json",
    "_locales/zh/neopixel-strings.json",
    "_locales/zh/neopixel-jsdocs-strings.json"
],
```

### Testing your translations

Unfortunately, we currently don't have a seamless experience to test your translations locally.
You will need to modify our editor so that your extension becomes a first-party extension, meaning it will be directly included in the editor when it is built.
Then, when you run the editor locally, you will be able to add your extension to a project.
There are a lot of steps to get this working, so follow closely.

#### 1. Clone the target repo

- Open the command line
- Navigate to a folder where you will download the editor repo
- Using Git, clone the editor repo to which your extension applies
>    As an example, for micro:bit: `git clone https://github.com/microsoft/pxt-microbit`

#### 2. Install the target

- In the command prompt, navigate to the target repo you just cloned
- Run `npm install`

#### 3. Bundle your extension with the target

- Copy your entire extension directory (your fork that you translated) to the `libs/` folder of the editor repo
>For example, for micro:bit and pxt-neopixel extension, you would copy your fork to `pxt-microbit/libs/pxt-neopixel`
- Change the name of the copied folder so it matches the `name` setting in the extension configuration file
>- The extension configuration file is called `pxt.json` and is at the root of your forked extension, for example `pxt-neopixel/pxt.json`
>- Inside that file, you will find the `name` setting, for example `"name": "neopixel"`. This is what you must rename the copied folder to.
>- So, in this example, I would rename `pxt-microbit/libs/pxt-neopixel` to `pxt-microbit/libs/neopixel`
- Once that's done, open the editor's `pxtarget.json` file, located at the root of the editor repo
>For example, for micro:bit, this file is at `pxt-microbit/pxtarget.json`
- In the file, search for `bundledirs` to find a configuration setting that looks like this:

```
"bundleddirs": [
    "libs/core",
    "libs/radio",
    "libs/devices",
    "libs/bluetooth"
],
```
>   If the setting isn't there, simply add an empty one at the top of the file, like so:

```
{
    "bundleddirs": [

    ],
    ...
}
```

- Add the copied extension to the list of bundled dirs (**use the modified name**)
>   For example, for micro:bit and pxt-neopixel, using the name **neopixel**:

```
"bundleddirs": [
    "libs/core",
    "libs/radio",
    "libs/devices",
    "libs/bluetooth",
    "libs/neopixel"
],
```
- While still in `pxtarget.json`, find the `appTheme` setting
- Inside the `appTheme` setting, add a new entry called `"disableLiveTranslations": true`
>    For example, the final result would be:

```
"appTheme": {
    "disableLiveTranslations": true,
    ...
},
```
- Save and close the file
- Now, open the copied extension's configuration file (`pxt.json`).
>**Note:** Open the one from the copied extension, for example `pxt-microbit/libs/neopixel/pxt.json`
- Look for the `dependencies` setting, and locate the entry that says `"core"`
- Change the `"core"` value from `"*"` to `"file:../core"`
>    For example, this is what it should look like:

```
"dependencies": [
    "core": "file:../core",
    ...
],
```
- Still in that file, change the `"description"` setting to something else so you can easily recognize your forked extension from the real extension
>    For example, for pxt-neopixel, you could change the description to `"description": "My translated neopixel extension"`
- Save and close the file
- Go back to the command prompt and navigate to your copied extension, for example `pxt-microbit/libs/neopixel`
- Run `pxt install`

#### 4. Serve the target

- In the command prompt, navigate to the root of target repo, for example `pxt-microbit/`
- Run `pxt serve --cloud`

#### 5. Launch the local editor

- When the build is finished, your browser should open automatically to a local version of the editor
- If it does not automatically launch, just open your browser and navigate to the URL shown in the console output:

![](/static/images/serve-url.png)

>    - You may need to scroll up a bit to find the URL from which the local editor is being served
- Change the language in the editor to your translated language (**Menu > Language**)
>    - If the language does not appear in the language list, you'll need to change the language via the editor's URL instead. Add `?forcelang=[language code]` to the URL, before the `#` part

>>For example, if French (fr) is not enabled for the target you're testing: `http://localhost:3232/?forcelang=fr#local_token=...`

#### 6. Add your extension to a project

- Create a new project in the local editor
- Go to **Advanced > Extensions** (or **Advanced > Add package**, depending on the editor)
- Find your extension in the list and add it to your project
>    - Make sure you add your own translated fork, and not the real extension (look for your modified description to differentiate them)
- Your extension's category should now be available in the toolbox, and the blocks inside should reflect your translations!

If you need to make changes to the translations:

- Make the modifications in your **original** extension folder (your fork that you cloned)
>    For example, go back to `pxt-neopixel/_locales/fr/neopixel-strings.json`
- When you're done, copy the modified `.json` file(s) over to your extension copy under the editor's `libs/` folder
>    For example, after modifying French pxt-neopixel translations, you would copy `pxt-neopixel/_locales/fr/neopixel-strings.json` and overwrite `pxt-microbit/libs/neopixel/_locales/fr/neopixel-strings.json` with it
- Stop the local server by going to the command prompt where the local server is running and hitting **Ctrl + c** twice
- Start the local server again by running `pxt serve --cloud` once more
- Launch the local editor again (if it does not launch automatically) and go back to your project. You should see your updated translations

### Committing your translations to the extension repo

Once you're satisfied with your translations, you must merge them to the extension repo.
If you're the extension author, just commit and push the `_locales` directory to your GitHub repo.

If you don't have write access to the repo you are translating (i.e. you created a fork of the extension), you will need to open a pull request on the extension repo so the author can merge your translations:

#### 1. Push your changes to your fork

- In the command prompt, navigate to your fork
- Commit your work:
>    - Run `git add --all` to stage your modifications
>    - Run `git commit -m "A short message describing your changes, e.g. Added French translations"`
- Push your work to your fork: `git push`

#### 2. Create a pull request in the extension repo

- Go to the GitHub website and navigate to the extension repo
>    For example for pxt-neopixel: https://github.com/Microsoft/pxt-neopixel
- Click **Pull requests** in the top bar

![](/static/images/gh-pull-request.png)

- Click on **New pull request**

![](/static/images/gh-new-pull-request.png)

- Click on **compare across forks**

![](/static/images/gh-compare-forks.png)

- In the dropdown that appears, select your fork

![](/static/images/gh-select-fork.png)

- Now GitHub will show you the difference between your fork and the extension repo. **Make sure you recognize all the changes that are shown**. If there are changes in there that you did not make, it might mean your fork is in a bad state.
- If the displayed changes look good, click **Create pull request**

![](/static/images/gh-create-pr.png)

- In the text box that appears, write a short description for your pull request
- When ready, click **Create pull request** again

That's it! Now you simply have to wait for the repo owner to merge your changes and update the extension version.