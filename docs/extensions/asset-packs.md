# Asset packs

Certain editors (such as [MakeCode Arcade](https://arcade.makecode.com)) can include resource files inside of projects. The resources, or _assets_, might contain byte respresentations of images, animations, sounds, tilemaps, etc.

An extension containing assets may use them to support the code provided in the extension (custom buttons, animations, etc.). However, you can mark an extension to import only its assets and not include any of the code exported in the extension. This is useful as a way to package reusable assets and publish them for others to use in their projects.

## Assets in the extension

Assets are included as part of the `files[]` list in the `pxt.json` file. As an example, here are some shark image assets in a MakeCode Arcade extension.

![Shark image assets](/static/extensions/shark-image-assets.png)

These images are contained and loaded using the `assets.json` and `images.*` files.

```json
{
    "name": "hungry-sharks",
    "description": "",
    "dependencies": {
        "device": "*"
    },
    "files": [
        "main.blocks",
        "main.ts",
        "README.md",
        "assets.json",
        "images.g.jres",
        "images.g.ts"
    ],
    "preferredEditor": "tsprj"
}
```

## Commit settings

When committing project changes to GitHub, if assets are present, an **Import as asset pack** option appears in the 'Extension zone' of the commit operation window.

![Import assets not set](/static/extensions/asset-pack-unset.png)

Turning on this option will cause the editor to only load the assets in the extension and ignore any code.

If a project already has the import option, `pxt.json` will contain the setting `"assetPack": true` and the settings in the commit operation window will show the **Import as asset pack** option as set.

![Import assets set](/static/extensions/asset-pack-set.png)