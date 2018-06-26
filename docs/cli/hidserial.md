# pxt-hidserial Manual Page

### @description Monitors serial output from certain boards

Monitors serial output from certain boards (in particular SAMD21 ones)

```
pxt hidserial
```

## Installation

This command relies on [node-hid](https://github.com/node-hid/node-hid), a native package for Node.JS. To install this package, run

    pxt npminstallnative

## Description

When using Codal runtime, PXT sends data from `console.log()` and friends
over a [custom USB HID protocol called HF2](https://github.com/Microsoft/uf2/blob/master/hf2.md). 
The protocol supports a number of other features, including flashing and some debugging.
HF2 works on all major operating systems (including Windows 7) without the need 
for any drivers.

`pxt hidserial` just dumps serial data to standard output. When using `pxt serve` and developing
at `http://localhost:3232`, the HID serial is forwarded to the browser, so there is no
need to use `pxt hidserial`.

Other useful HID command include `pxt hidlist` to list connected HID devices
and `pxt hiddmesg` to dump Codal debug buffer. PXT can also deploy over HID - this
is the default when using command line or `pxt serve`.

## See Also

[pxt](/cli) tool
