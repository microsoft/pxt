# pxt-target Manual Page

### @description Installs the editor files

Installs the compiled editor files.

## ~ hint

This command only works for editors that are open sourced.

## ~

```
pxt target TARGET [tag]
```

## Description

This commands runs ``npm`` and installs the packaged editor files. You need to run this command before you can build or serve an editor locally.

## Flags:

### TARGETID

The identifier for the editor. It is the value for the ``id`` field in the ``pxtarget.json`` file which is each editor's repository.

* for micro:bit, ``microbit``
* for Circuit Playground, ``adafruit``,
* for Maker, ``maker``

### tag (optional)

Allow the addition of an optional NPM distribution tag.
