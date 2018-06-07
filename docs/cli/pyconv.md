# pxt-pyconv Manual Page

### @description Converts from MicroPython to PXT

Convert a MicroPython module(s) to PXT

```
pxt pyconv <directory> [<support directory>...]
pxt pyconv <file.py>... [<support directory>...]
```

## Operation

All modules found in `<directory>` will be converted and written out in current directory.
Modules are detected by presence of `setup.py`, `README.rst` or similar files.

If instead of directory you specify one or more `.py` files, they will be converted.

Additional Python modules will be searched for in the support directories. They are converted
in background, but the results are not written.

## Where is python?

The command requires **Python 3** with ``py`` on Windows or ``python3`` executable to be in the `PATH`. Or you can specify the python path
in the ``PYTHON3`` environment variable.

## Limitations

Only a small fragment of Python is supported. The output is meant to be a starting
point for a PXT module.

* `__getitem__`, `__setitem__` (indexers) are not supported
* scopes of variables can get confused - you might need to pull out variables by hand

`try`/`catch` is converted by not supported by PXT yet.

## See Also

[pxt](/cli) tool
