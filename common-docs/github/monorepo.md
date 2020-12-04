# Mono Repo

## ~ hint

This is a recent feature that is not yet available in the released editors.

## ~

It is possible to store multiple MakeCode **nested extensions** in the same GitHub repository. If you have very large packages, or too many of them,
you might want to consider this solution.

## How it works

Any MakeCode extension GitHub repository have any number of nested extensions in sub folders. **Having a top-level extension is required.**

The file structure of an extension containing 2 sub extensions, ``button`` and ``slider`` would look as follows:

```
/pxt.json // the main extension, can be a dummy file
/button/pxt.json
           /...
/slider/pxt.json
           /...        
```

## How to create a new nested extension?

Created a nested extension is not supported in the MakeCode editor user interface. We recommend creating an empty repository; then moving the files in your favorite Git editor.

## How to reference a nested extension?

You can add the nested extension through the Add Extension dialog by adding the folder path to the repo url:

    https://github.com/owner/name/path

The reference syntax in ``pxt.json`` will look similar to existing github refences, with the added path:

```
    "dependencies": {
        ...
        "button": "github:contoso/ui/button",
    }
```