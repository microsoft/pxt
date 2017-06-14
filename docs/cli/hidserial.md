# pxt-hidserial Manual Page

### @description Monitors serial output from certain boards

Monitors serial output from certain boards (in particular SAMD21 ones)

```
pxt hidserial
```

## Description

When using Codal runtime, PXT sends data from `serial.writeLine()` and friends
over a [custom USB HID protocol called HF2](https://github.com/Microsoft/uf2/blob/master/hf2.md). 
The protocol supports a number of other features, including flashing and some debugging.

`pxt hidserial` just dumps data to standard output. When using `pxt serve` and developing
at `http://localhost:3232`, the HID serial is forwarded to the browser, so there is no
need to use `pxt hidserial`.

Other useful HID command include `pxt hidlist` to list connected HID devices
and `pxt hiddmesg` to dump Codal debug buffer.

## See Also

[pxt](/cli) tool
