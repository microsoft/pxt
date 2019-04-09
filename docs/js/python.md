# Python Converter

**This is work in progress**

The Python to TypeScript converter doesn't support all of Python language.
This document describes the differences and tracks various TODOs.

## Not supported

*  `-*- coding: encoding -*-` (only UTF8 is supported)
* leading tabs in lines are not allowed at all
* class private names `__*` are not mangled
* complex and imaginary numbers
* big integers
* Formatted string literals (for now)
