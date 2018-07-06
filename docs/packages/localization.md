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
1. [Clone the target repo](#)
2. [Install the target](#)
3. [Include your package in the target's configuration](#)
4. [Serve the target](#)
5. [Navigate to the local editor](#)
6. [Add your package to a project](#)

### Committing your translations to the package repo
If you're not the author of the package you're translating, you'll need to ask them to merge your translations into their repo.
1. [Push your changes to your fork](#)
2. [Open a pull request in the package repo](#)

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
  - For example:
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
TODO

## Committing your translations to the package repo
TODO