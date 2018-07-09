# Package localization files

Packages can contain localized strings in JSON resource files. This page will go in depth on how to localize a package.

## Overview
### Preparation
1. [Install NodeJS](#1-Install-NodeJS)
2. [Install the PXT command-line tool](#2-Install-the-PXT-command-line-tool)

If translating someone else's package from GitHub:

3. [Fork the package's repo in GitHub](#3-Fork-the-package-repo-in-GitHub)
4. [Clone your fork to your computer](#4-Clone-your-fork-to-your-computer)

### Translating
1. [Prepare the package for building](#1-Prepare-the-package-for-building)
2. [Extract the strings](#2-Extract-the-strings)
3. [Create the translations](#)
4. [Add the translation files to the package configuration](#4-Add-the-translation-files-to-the-package-configuration)

### Testing your translations
1. [Clone the target repo](#1-Clone-the-target-repo)
2. [Install the target](#2-Install-the-target)
3. [Bundle your package with the target](#3-Bundle-your-package-with-the-target)
4. [Serve the target](#4-Serve-the-target)
5. [Launch the local editor](#5-Launch-the-local-editor)
6. [Add your package to a project](#6-Add-your-package-to-a-project)

### Committing your translations to the package repo
If you're not the author of the package you're translating, you'll need to ask them to merge your translations into their repo.
1. [Push your changes to your fork](#1-Push-your-changes-to-your-fork)
2. [Create a pull request in the package repo](#2-Create-a-pull-request-in-the-package-repo)

----
## Step by step instructions

## Preparation

### 1. Install NodeJS
- Go to https://nodejs.org/en/download/
- Download & run the "LTS" installer for your platform

![](/static/images/download-node-js.png)

### 2. Install the PXT command-line tool
- Open a command prompt and run `npm install -g pxt`

### 3. Fork the package repo in GitHub
You only need to do this if you are not the author of the package you are translating.

- Find the package you wish to translate on GitHub, for example [the motor:bit](https://github.com/Tinkertanker/pxt-motorbit)
- Click the "Fork" button in the top-right

![](/static/images/github-fork.png)

- When asked where to put the fork, just choose your username

### 4. Clone your fork to your computer
- In the command prompt, navigate to a folder where you wish to download the package fork
- Run `git clone https://github.com/[your username]/[the repo name]`
  - For example `git clone https://github.com/myGithubAccount/pxt-motorbit`

## Translating

### 1. Prepare the package for building
- In the command prompt, navigate to the directory where the package is (your fork, if you're translating someone else's package)
- Run `pxt target [target]`, for example `pxt target microbit` if the package is for the micro:bit
- Run `pxt install`

### 2. Extract the strings
- Run `pxt gendocs --locs`

This will create a `_locales` folder in the root of the package.
In that folder, you'll find various `.json` files. These files contain the strings to translate.

### 3. Create the translations
- Under the `_locales/` folder, create a new folder and name it the ISO code for the language you want to translate to
  - For example, `_locales/fr/` for French, `_locales/es/` for spanish, etc
- Copy all the `.json` files under `_locales/` and paste them into your new language folder
- Open the `.json` files from under your language folder and edit the string values inside them
  - The files are in the following format:
  ```
  {
      "string id": "string value"
  }
  ```
  - To translate the strings, change the string values (after the `:`)
  - Be careful not to remove the special characters, such as `%`, `|`, etc. These characters are parsed by our editor to generate the blocks.
  - For example, `"motorbit.turnleft|block": "turn left with speed %n"` would become `"motorbit.turnleft|block": "tourner à gauche avec vitesse %n"` in French.

### 4. Add the translation files to the package configuration
Once you're done editing the `.json` files, you must add them to the package configuration so that our editor recognizes them.
- In the package root, open the file `pxt.json`
- Find the `files: [...]` entry, it will look something like:
```
"files": [
    "README.md",
    "neopixel.ts"
],
```
- Add your files to the list by including their relative path from the root of the package
  - For example, if you translated to JA and ZH:
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

## Testing your translations
Unfortunately, we do not currently have a seamless experience to test your translations locally.
You will need to modify our editor so that your package becomes a first-party package, meaning it will be directly indluded in the editor when it is built.
Then, when you run the editor locally, you will be able to add your package to a project.
There are a lot of steps to get this working, so follow closely.

### 1. Clone the target repo
- Open the command line
- Navigate to a folder where you will download the editor repo
- Using Git, clone the editor repo to which your package applies
  - For example for micro:bit: `git clone https://github.com/microsoft/pxt-microbit`

### 2. Install the target
- In the command prompt, navigate to the target repo you just cloned
- Run `npm install`

### 3. Bundle your package with the target
- Copy your entire package directory (your fork that you translated) to the `libs/` folder of the editor repo
  - For example for micro:bit and pxt-neopixel package, you would copy your fork to `pxt-microbit/libs/pxt-neopixel`
- Change the name of the copied folder to something else, so it doesn't conflict with the real package
  - For example for the pxt-neopixel package, you could change the copied folder name to: `pxt-microbit/libs/pxt-neopixel2/` (notice the **2** in the name)
- Open the editor's `pxtarget.json` file, located at the root of the editor repo
  - For example for micro:bit, this file is at `pxt-microbit/pxtarget.json`
- In the file, search for `bundledirs` to find a configuration setting that looks like this:
  ```
    "bundleddirs": [
        "libs/core",
        "libs/radio",
        "libs/devices",
        "libs/bluetooth"
    ],
  ```
  - If the setting isn't there, simply add an empty one at the top of the file, like so:
  ```
  {
    "bundleddirs": [

    ],
    ...
  }
  ```
- Add your package to the list of bundled dirs (**use the modified name**)
  - For example for micro:bit and pxt-neopixel, using the name **pxt-neopixel2** that I used in the previous step:
  ```
    "bundleddirs": [
        "libs/core",
        "libs/radio",
        "libs/devices",
        "libs/bluetooth",
        "libs/pxt-neopixel2"
    ],
  ```
- Still inside `pxtarget.json`, find the `appTheme` setting
- Inside the `appTheme` setting, add a new entry called `"disableLiveTranslations": true`
  - For example, the final result would be:
  ```
  "appTheme": {
    "disableLiveTranslations": true,
    ...
  },
  ```
- Now, open the copied package's configuration file (`pxt.json`), for example `pxt-microbit/libs/pxt-neopixel2/pxt.json`
- Change the name of your package to something else, for example:
  ```
  {
    "name": "neopixel2",
    ...
  }
  ```
- Look for the `dependencies` setting, and locate the `core` dependency
- Change the `core` dependency value from `"*"` to `"file:../core"`
  - For example, this is the final result:
  ```
  "dependencies": [
    "core": "file:../core",
    ...
  ],
  ```
- In the command prompt, navigate to your copied package, for example `pxt-microbit/libs/pxt-neopixel2`
- Run `pxt install`

### 4. Serve the target
- In the command prompt, navigate to the target repo, for example `pxt-microbit/`
- Run `pxt serve --cloud`

### 5. Launch the local editor
- When the build is finished, your browser should open automatically to a local version of the editor
- If it does not automatically launch, just open your browser and navigate to the URL shown in the console output:

![](/static/images/serve-url.png)

  - You may need to scroll up a bit to find the URL from which the local editor is being served
- Change the language in the editor to your translated language (**Menu > Language**)
  - If the language does not appear in the language list, you'll need to change the language via the editor's URL instead. Add `?forcelang=[language code]` to the URL, before the `#` character
  - For example, if French (fr) is not enabled for the target you're testing: `http://localhost:3232/?forcelang=fr#local_token=...`

### 6. Add your package to a project
You cannot add your package in the traditional way (Advanced > Add Package).
You will need to manually modify the configuration file of a project.

- Create a new project in the local editor. This will create a folder on your computer where the project is saved.
- In the file explorer of your machine, find the folder for this new project you just created. It is found under the `projects/` folder inside the editor repo.
  - For example, for micro:bit, your project will be at `pxt-microbit/projects/untitled`
- Inside your project folder, you will find a `pxt.json` configuration file; open it
- Find the `dependencies` section, and add your package to the list of dependencies
  - For example, for `pxtneopixel2` that I used above, the final result would be:
  ```
    "dependencies": {
        "core": "*",
        "radio": "*",
        "pxt-neopixel2": "*"
    },
  ```
- Go back to the local editor in your browser, and refresh the page. You should now see a new category for your package, and the blocks inside it should reflect your translations.
- If you need to change the translations, change then in your **original** package folder (your fork that you cloned), and when you're done, copy the `.json` file over to your copied package under `libs/`
  - For example, after modifying my French pxt-neopixel fork translations, I would copy `pxt-neopixel/_locales/fr/neopixel-strings.json` and use it to overwrite `pxt-microbit/libs/pxt-neopixel2/_locales/fr/neopixel-strings.json`

## Committing your translations to the package repo
Once you are satisfied with your translations, you must merge them to the package repo.
If you are the package author, just commit and push the `_locales` directory to your GitHub repo.

If you do not have write access to the repo you are translating (i.e. you created a fork of the package), you will need to open a pull request on the package repo so the author can merge your translations:

### 1. Push your changes to your fork
- In the command prompt, navigate to your fork
- Commit your work:
  - Run `git add --all` to stage your modifications
  - Run `git commit -m "A short message describing your changes, e.g. Added French translations"`
- Push your work to your fork: `git push`

### 2. Create a pull request in the package repo
- Go to the GitHub website and navigate to the package repo
  - For example for pxt-neopixel: https://github.com/Microsoft/pxt-neopixel
- Click **Pull Requests** in the top bar

![](/static/images/gh-pull-request.png)

- Click on **New pull request**

![](/static/images/gh-new-pull-request.png)

- Click on **Compare across forks**

![](/static/images/gh-compare-forks.png)

- In the dropdown that appears, select your fork

![](/static/images/gh-select-fork.png)

- Now GitHub will show you the difference between your fork and the package repo. **Make sure you recognize all the changes that are shown**. If there are changes in there that you did not make, it might mean your fork is in a bad state.
- If the displayed changes look good, click **Create pull request**

![](/static/images/gh-create-pr.png)

- In the text box that appears, write a short description for your pull request
- When ready, click **Create pull request** again

That's it! Now you simply have to wait for the repo owner to merge your changes and update the package version.