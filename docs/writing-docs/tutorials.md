# Tutorials

Step by step tutorials like the "getting started" tutorial are authored in markdown and automatically converted by the editor. This page describes the format for such tutorials.

### ~ hint

Learning by examples? Checkout this tutorial.

* https://github.com/Microsoft/pxt-microbit/docs/tutorials/getting-started.md 

### ~

## Format

A tutorial is defined by a markdown page where each level 3 heading (``###``) starts a new step.
The editor will automatically parse the markdown and populate the user interface from this structure.

In each step,  the first sentence will be displayed to the user and the rest of the text will be displayed
in the ``hint`` section. You can use code snippets, images or videos in the hint section.

## Example

The following sample shows a simple 2 step tutorial.

````
# Getting started

### Step 1

Welcome! Place the ``||show string||`` block in the ``||on start||`` slot to scroll your name.

```blocks
basic.showString("Micro!")
```

### Step 2

Click ``|Download|`` to transfer your code in your @boardname@!

````

## Translations

Tutorials are translated via [Crowdin](/translate) like any other documentation page.