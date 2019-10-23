# pxt-buildsprites Manual Page

## @description Encode sprite sheets into a Jres resource

Encode sprite sheets into a Jres resource

```
pxt buildsprites DIRECTORY
```

where DIRECTORY is a folder containing PNG images and a ``meta.json`` file.

This needs to run in an extension directory and will generate one `.jres` and one
`.ts` file.

Example `meta.json` file:

```json
{
    "blockIdentity": "image.__imagePicker",
    "creator": "image.ofBuffer",
    "star": {
        "namespace": "images.castle",
        "mimeType": "image/x-mkcd-f4"
    }
}
```

The `image/x-mkcd-f4` specifies a 4 bit per pixel (indexed 16 colors) image format.
The PNG images can be in any format, but the output will be 16 colors.

You can also use `image/x-mkcd-f1` for monochromatic.

In either case one of your `pxt.json` files, referenced from the current package (including
the current package `pxt.json` itself) needs to have `palette` field defined.
Example:

```json
{
    // ...
    "palette": [
        "#000000",
        "#ffffff"
    ]
    // ...
}
```

### Multiple sprites per file

If your PNG files contain more than one sprite each, you can add the following
to the `meta.json` file:

```json
{
    "width": 16,
    "height": 8,
    // ...
}
```

This will cut the PNG images into separate frames of specified size.

The width/height settings as well as names of generated sprites,
can be overridden per PNG file. For example, if you have `princess.png` image
with different directions in which 16x16 sprite is going you would use the following:

```json
{
    "width": 16,
    "height": 16,
    "frames": [
        "Front0",
        "Front1",
        "Front2",
        "Left0",
        "Left1",
        "Left2",
        "Back0",
        "Back1",
        "Back2"
    ]
}
```

The frames will be called `images.castle.princessFront0` etc., where the namespace
is taken from `meta.json` above, `princess` from file name, and the suffix from `frames`
field.

### Tags

You can add tags that describe your sprites in the `meta.json` file.

```json
{
    "tags": "character hero"
    // ...
}
```

These can be used to filter sprites into (or out of) galleries in the image editor.

These tags should be separated by spaces.
If you want a tag to only be used to include the sprite in a gallery and not to exclude it,
you can start the tag with a question mark ``?``.
For example, if you have a sprite that is a pretty flower,
that can be used as a flower but also on it's own,
you might set it to have the following tags:

``flower ?tile``

Note that tags are **case insensitive**.

You can add tags per PNG file as well. If both the `meta.json` and
the `json` file for the specific PNG contain tags, then **both** sets are included.

### Filters

Tags can be used to **include** or **exclude** images from galleries.
In blocks, these can be used with a filter defined for the Sprite Editor.
This filter is a string containing a space separated series of tags.
When the first character of a tag is an exclamation mark ``!``,
that tag will be excluded from the gallery.

For example, if a sprite editor is set to have the following filter:

``flower !tile``

Then the gallery will contain **only** sprites with the ``flower`` tag,
that do not contain the ``tile`` tag.

Note that filters are **case insensitive**.

## See Also

[pxt](/cli) tool
