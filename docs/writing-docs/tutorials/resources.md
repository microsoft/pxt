# Resource sections

Resource sections allow tutorials to have complex objects included as part of the tutorial document. In a normal project, these would be in a separate source file among the set of other files contained in the project. As a convenience, these resource objects (such tilemaps for game programs) can be added to a tutorial document for use in the hints and the user code for the tutorial activity.

## jres

Resource sections use the ```` ```jres```` markdown tag and the objects are contained in a generic JSON definition. The ```` ```jres```` block can go anywhere in the tutorial page but it's often placed near the end so as to not clutter the text for the tutorial steps.

````
```jres
{
    "tile1": {
        "data": "hwQQABAAAACIiIiIiIiIiIiIiIiIiIiIiISIiIiIiIiISIiIiIhIiIiIhIiIiISIiIhIiIhIiIiIiIiEiISIiIiIiEhIiIiIiIiIiISIiIiIiIhISIiIiIiIiISIhIiIiIhIiIhIiIiIiISIiIiEiIhIiIiIiEiIiIiIiIiIiISIiIiIiIiIiA==",
        "mimeType": "image/x-mkcd-f4",
        "tilemapTile": true
    }
}
```
````

### Tiles and tilemaps

The most common use of ```` ```jres```` resourses is for tiles, tilemaps, or maybe some built-in images for game programs. These can be created in the MakeCode editor and then copied directly from the ``.jres`` project files.

Here's an example tilemap extracted from a [MakeCode Arcade](https://arcade.makecode.com) ``.jres`` file:

````
```jres
{
    "transparency16": {
        "data": "hwQQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
        "mimeType": "image/x-mkcd-f4",
        "tilemapTile": true
    },
    "tile1": {
        "data": "hwQQABAAAACIiIiIiIiIiIiIiIiIiIiIiISIiIiIiIiISIiIiIhIiIiIhIiIiISIiIhIiIhIiIiIiIiEiISIiIiIiEhIiIiIiIiIiISIiIiIiIhISIiIiIiIiISIhIiIiIhIiIhIiIiIiISIiIiEiIhIiIiIiEiIiIiIiIiIiISIiIiIiIiIiA==",
        "mimeType": "image/x-mkcd-f4",
        "tilemapTile": true
    },
    "level": {
        "id": "level",
        "mimeType": "application/mkcd-tilemap",
        "data": "MTAxMDAwMTAwMDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMjAyMDIwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMjAyMDIwMjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAyMDIwMjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMA==",
        "tileset": [
            "myTiles.transparency16",
            "myTiles.tile1",
            "sprites.castle.tileGrass2"
        ]
    },
    "*": {
        "mimeType": "image/x-mkcd-f4",
        "dataEncoding": "base64",
        "namespace": "myTiles"
    }
}
```
````

The ``level`` tilemap can be used in tutorial hints throughout the document, like in this example where a user is prompted to add button event after a previous step where the tilemap is created:

````
## Step 2 - Create tilemap

Create the scene for your level with a tilemap.

```blocks
tiles.setTilemap(tilemap`level`)
```

## Step 3 - Add the Button A event

Now, put in an event to detect when button **A** is pressed.

```blocks
tiles.setTilemap(tilemap`level`)
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {

})
```
````

## assetjson

If you want a collection of pre-created tilemaps, images, animations, and tiles included as `assets`
in a tutorial, you can add them inside an ```` ```assetjson ```` block. This makes the assets
available in the **Assets Editor**, and to the code in the tutorial, when the tutorial is started.

### ~reminder

#### Asset editing support

Support for creating and importing assets is only available in [Microsoft MakeCode Arcade](https://arcade.makecode.com).

### ~

### Importing custom assets

To import all assets (tilemaps, images, animations, and tiles) into the tutorial at once,
start the editor by adding `?savetemplate=1` to the end of your URL. For example, the URL
for Arcade's beta editor would be:

https://arcade.makecode.com/beta?savetemplate=1

With the correct URL entered, you can click the save button (the floppy disk button) in the
editor to download your project as a `.txt.mkcd` file.

Next, define a ```` ```assetjson ```` block in your tutorial document.

````
```assetjson

```
````

The contents of this file can be opened in a separate text editor, copied, and pasted into
the ```` ```assetjson ```` block to have them included when the tutorial is run.
The asset block might look something like the following example.

````
```assetjson
{
  "README.md": " ",
  "assets.json": "",
  "images.g.jres": "{\n    \"image1\": {\n        \"data\":
  \"hwQgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAYAYAAAAAAAAAAAA
  AAAAABmBmYAAAAAAAAAAAAAAAAAZmZmAABgBgAAAAAAAAAAAGBmZgAAZgYAAAAAAAAAAAAAZmYAAGYG
  AAAAAAAAAAAAAGZmAGBmBgAAAAAAAAAAAABmZgBmZgYAAAAAAAAAAGYAZmYAZmYAAAAAAAAAAABmAGZ
  mYGZmAAAAAAAAAAAAZgZmZmZmBgAAAAAAAAAAAGBmZmZmZgYAAAAAAAAAAABgZmZmZmYAAAAAAAAAAA
  AAAGZmZmZmAAAAAAAAAAAAAABmZmZmBgAAAAAAAAAAAAAAYGZmZgYAAAAAAAAAAAAAAGBmZmYAAAAAA
  AAAAAAAAABg9mZmAAAAAAAAAAAAAAAAYPZmZgAAAAAAAAAAAAAAAAD/b2YAAAAAAAAAAAAAAAAA/29m
  AAAAAAAAAAAAAAAAAP9vZgAAAAAAAAAAAAAAAAD//

  ...

  d1e057830c0eebc87e3e400f2106c8e1f0e5a077\",\n        \"target\": \"1.3.44\",\n
        \"pxt\": \"6.8.33\"\n    },\n    \"preferredEditor\": \"blocksprj\"\n}\n"
}
```
````

If you need to modify the assets for the tutorial, reopen and edit the project saved in the `.txt.mkcd` file.
You can simply drag the file into the editor, make your changes, and download it again. Open the project
file in a text editor, copy the new asset data, and replace the contents of your tutorial's ```` ```assetjson ````
block with it.

The assets are shown as the initial view in a tutorial by using the [@preferredEditor](/writing-docs/tutorials/control-options#preferred-editor-view) option. This option causes the tutorial to open with the Asset Editor
rather than showing the editor for Blocks or Code.

## Creating asset packs

### ~ alert

#### MakeCode Arcade only

Asset packs only work with MakeCode Arcade.

### ~

Asset packs are resource projects that are separate from a tutorial file. They contain images, animations, tilemaps, and other resources for use in a tutorial. An asset pack can help reduce the size of a tutorial when it's using many resources or very large resources. You may place some or all your tutorial resources into an asset pack project.

Here are the instructions for creating an asset pack:

1. Create a new project. The name of this project will end up being the namespace of the asset pack you create, so make sure to rename it to a valid javascript variable name (no spaces, only letters, underscores, and numbers). For example, `my_asset_pack`.
2. Switch to the **Assets** tab.
3. Create a new image (or other asset item). Copy the image text your tutorial and paste it into image space in the editor for the new asset.
4. Give the asset a name in the bottom right of the image editor. This name will be the name you reference in your code, so make sure it’s a valid javascript variable name. For example, `background1`.
5. Close the image editor and switch to the **JavaScript** tab.
6. On the left, in the file explorer underneath the simulator, open up pxt.json
7. Click "Edit settings as text".
8. Underneath the line that says "description", paste in this line:<br/> `"assetPack": true`<br/>
9. In the file explorer, switch back to main.ts.
10. Turn this project into a GitHub repo using the GitHub button in the bottom toolbar (for example, my_github_username/my_asset_pack).

Now that you have an asset pack, you can include it in your tutorial just like you would an extension. Add an annotation like this at the bottom of your markdown file:

````
```package
my_asset_pack=github:my_github_username/my_asset_pack
```
````

**Important**: Make sure that the name on the left hand side of the "=" matches the name of your extension from Step 1. However, if the asset pack's repository name contains "-" such as `github:my_github_username/my-asset-pack`, the name on the left of the "=" should remove the "-" characters such that `my-asset-pack` becomes `myassetpack`.

Now, instead of including the background image in your code snippets, you can reference it like so:

````
```blocks
scene.setBackgroundImage(my_asset_pack.background1)
```
````

For more details on how to create an asset pack for your tutorial, watch this helpful video:

https://youtu.be/ikz15E24F2k

If you have other assets you want to include, you can insert them into the pack in the same manner.
