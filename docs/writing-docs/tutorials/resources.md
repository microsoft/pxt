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


## Custom assets (Arcade beta only)

To import all assets (Tilemaps, Images, Animations, and Tiles) into the tutorial at once, use the ```` ```assetsjson ``` ```` language block. You can get the assets for your project by adding `?savetemplate=1` to the end of your URL. For example, the URL for arcade's beta editor would be:

https://arcade.makecode.com/beta?savetemplate=1

With the correct URL entered, you can click the save button (the floppy disk) in the editor to download your project as a `.txt.mkcd` file. The contents of this file can be opened in a text editor and pasted into the ```` ```assetsjson ``` ```` block to configure the tutorial. To reopen and edit the project, simply drag the original `.txt.mkcd` into the editor and repeat the process to download it again.