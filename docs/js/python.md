# Python Converter

**This is work in progress**

The Python to TypeScript converter doesn't support all of Python language.
This document describes the differences and tracks various TODOs.

## Not supported

*  `-*- coding: encoding -*-` (only UTF8 is supported)
* leading tabs in lines are not allowed at all
* class private names `__*` are not mangled


## Notes

A line ending in a backslash cannot carry a comment. A backslash does not continue a comment. A backslash does not continue a token except for string literals (i.e., tokens other than string literals cannot be split across physical lines using a backslash). A backslash is illegal elsewhere on a line outside a string literal.


