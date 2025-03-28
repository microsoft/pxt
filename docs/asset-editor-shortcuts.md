# Asset Editor Shortcuts

This document describes keyboard shortcuts that are available in the image, animation, and tilemap editors.

## Tool selection shortcuts

These shortcuts allow you to quickly switch between the tools in the editor.

| Shortcut       | Tool |
| ---------------| ----------- |
| **b** or **p** | Pen tool |
| **e**          | Eraser tool |
| **g**          | Fill tool |
| **l**          | Line tool |
| **u**          | Rectangle tool |
| **c**          | Circle tool |
| **m**          | Marquee tool |
| **q**          | Pan tool |
| **space**      | Temporarily enter pan mode (release space to return to previous tool) |
| **alt**        | Temporarily enter eyedropper mode (release alt to return to previous tool)

## Editor shortcuts

| Shortcut                          | Description |
| --------------------------------- | ----------- |
| **+**                             | Zoom in |
| **-**                             | Zoom out |
| **shift + .**                     | Increase pen size |
| **shift + ,**                     | Decrease pen size |
| **x**                             | Swap foreground and background colors/tiles |
| **ctrl + z** or **cmd + z** (mac) | Undo last edit |
| **ctrl + y** or **cmd + y** (mac) | Redo previous edit |
| **ctrl + a** or **cmd + a** (mac) | Select entire canvas with the marquee tool |
| **ctrl + c** or **cmd + c** (mac) | Copy current selection to clipboard |
| **ctrl + p** or **cmd + p** (mac) | Paste content from clipboard into the editor. When used with the tilemap editor, this will also import all used tiles from the pasted tilemap if they are not in the current project |

## Transformation shortcuts

These shortcuts are used to perform advanced edit operations on sprites or tilemaps.

Each of these shortcuts are affected by the marquee tool.
If a portion of the asset is selected by the marquee tool, then the shortcut transformation will only apply to the selected area.
If editing an animation, add the **shift** key to the shortcut to affect all frames at once.

| Shortcut       | Description |
| -------------- | ----------- |
| **Arrow Key**  | Move marquee tool selection by one pixel |
| **backspace**  | Delete current marquee tool selection |
| **h**          | Flip horizontally |
| **v**          | Flip vertically |
| **]**          | Rotate clockwise |
| **[**          | Rotate counterclockwise |
| **r**          | Replace all instances of selected background color/tile with selected foreground color/tile |


## Image/Animation editor-only shortcuts

These shortcuts are only available in the image and animation editors (not the tilemap editor).

| Shortcut                           | Description |
| ---------------------------------- | ----------- |
| **shift + 1-9** or **shift + a-f** | Outline the current image with the color in the palette corresponding to the selected number. For example, **shift + f** will outline with color number 15 (black) |
| **0-9**                            | Select a foreground color from the palette (first ten colors only) |
| **.**                              | Advance forwards one frame in the current animation |
| **,**                              | Advance backwards one frame in the current animation |
| **PageDown**                       | Swap the current animation frame with the next frame in the timeline |
| **PageUp**                         | Swap the current animation frame with the previous frame in the timeline |
| **shift + PageDown**               | Rotate all frames in the animation forwards one frame |
| **shift + PageUp**                 | Rotate all frames in the animation backwards one frame |
