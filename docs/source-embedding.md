# Source Embedding

The sources of a program can be embedded in HEX file, or any other format.  They are
flashed with the program on the device, so if the device supports read-back they
can be recovered from there.

This specification is in terms of the contents of the flash of the device,
not the particular file format, HEX or otherwise.

## Binary Header

The header is aligned to 16 bytes, and sits somewhere in the flash.
All numbers are unsigned little endian integers.

| Offset | Size | Value                                        |
|--------|------|----------------------------------------------|
| 0      | 8    | Magic, `"\x41\x14\x0E\x2F\xB8\x2F\xA2\xBB"`  | 
| 8      | 2    | JSON header length                           |
| 10     | 4    | Text length                                  |
| 14     | 2    | Reserved; write as zero                      |

Note that text length is not naturally aligned. This is due to
historical reasons (it used to be 16 bit long).

What follows is the JSON header and the text (possibly compressed), both
with the specified length.

## JSON header

The JSON header is UTF8 encoded JSON with the following fields:

* `eURL` (string): the URL of the editor
* `eVER` (string): semver of the editor
* `name` (string): name of the script (can be displayed by flashing tools)
* `compression` (string): specifies compression method; optional

Compression field specifies the encoding of the text section.
It can have one of the following values:

* `""` (or `null` or missing field) - no compression
* `"LZMA"` - LZMA raw compression

Editors should always check if the project was meant for them (ie., `eURL` and
`eVER` have sensible values). If not, the editor should present the user with a
dialog with an option to redirect to `eURL` (where the file needs to be loaded
again), or if it seems possible, with option to try to load the file in the current
editor.

There may be other fields, which are editor-specific.

This header should be kept small, since it is not compressed.

## Text

The interpretation of this section is editor-specific.

In case of PXT, the text is always LZMA compressed. If `headerSize` field of JSON header
is present and non-zero, then the first `headerSize` characters (not bytes) of the decompressed text
contain a JSON object that logically extends fields of the JSON header (but is compressed).
The remainder of the uncompressed text (or the entire text, if there is no header) is JSON files -
a map from file name to file content for all files in the project.

In case of a scripting language, the text can be raw, uncompressed,
and used straight by the interpreter.

## Caveats

Older versions of PXT and Touch Develop (as implemented in the legacy micro:bit programming
environment) didn't use `eURL`/`eVER`.

If the source is too large for the flash size it is not embedded.
