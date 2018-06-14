# pxt-hiddmesg Manual Page

### @description Fetch DMESG buffer over HID and print it

Fetch DMESG buffer over HID and print it

```
pxt hiddmesg
```

## Installation

This command relies on [node-hid](https://github.com/node-hid/node-hid), a native package for Node.JS. To install this package, run

```
pxt npminstallnative
```

## Description

The ``DMESG`` macro implements a circular buffer that allows you to "printf-debug" your
code at low cost.

```
    ...
    DMESG("%d %d %d %d", x, y, w, h);
    ...
```

## See Also

[pxt](/cli) tool
