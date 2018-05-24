# pxt-target Manual Page

### @description Installs the editor files

Installs the compiled editor files.

## ~ hint

This command only works for editors that have been open sourced.

## ~

```
pxt target TARGET [tag]
```

## Description

This commands runs ``npm`` and installs the packaged editor files. You'll need to run this command before being able to build or serve an editor locally.

## Flags:

### TARGETID

This is the identifier for the editor. It is the value of the ``id`` field in the ``pxtarget.json`` file in each editor repository.

* for micro:bit, ``microbit``
* for Circuit Playground, ``adafruit``,
* for Maker, ``maker``

### tag (optional)

Allows to specify an optional NPM distribution tag.