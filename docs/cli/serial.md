# pxt-serial Manual Page

### @description Monitors UART serial output from certain boards

Monitors UART serial output. Some boards support USB serial others requires to connect to the serial
pins.

```
pxt serial
```

## Installation

This command relies on [node-serialport](https://github.com/node-serialport/node-serialport), a native package for Node.JS. To install this package, run

    pxt npminstallnative

## Description

This command listen for UART message sent by the device via USB or serial pins.

## See Also

[pxt](/cli) tool
