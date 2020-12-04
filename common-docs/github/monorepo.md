# Mono Repo

## ~ hint

This is a recent feature that is not yet available in released editors.

## ~

It is possible to store multiple MakeCode **nested extensions** in the same GitHub repository. If you have very large packages, or too many of them,
you might want to consider using this solution.

## How it works

A MakeCode extension in a GitHub repository have any number of nested extensions in subfolders. **Having a top-level extension is required.**

The file structure of an extension containing 2 sub-extensions, ``button`` and ``slider`` might appear as follows:

```
/pxt.json // the main extension, can be a dummy file
/button/pxt.json
           /...
/slider/pxt.json
           /...        
```

## How to create a new nested extension?

First create a top level GitHub project using MakeCode. Once this is done, it is easy to add new nested repositories:

On the home screen, 

* click on **Import** then **Import URL**
* enter the GitHub repository URL including the path

    https://github.com/owner/name/path

MakeCode will generate a nested project for you.

## How to reference a nested extension?

You can add the nested extension through the **Add Extension** dialog by adding the folder path to the repo url:

    https://github.com/owner/name/path

The reference syntax in ``pxt.json`` will look similar to existing github references, with the added path:

```
    "dependencies": {
        ...
        "button": "github:contoso/ui/button",
    }
```
