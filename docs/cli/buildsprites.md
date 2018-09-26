# pxt-buildsprites Manual Page

### @description Encode sprite sheets into a Jres resource

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

## See Also

[pxt](/cli) tool
