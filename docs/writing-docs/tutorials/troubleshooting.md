# Troubleshooting

If your tutorial is not behaving properly or you receive an error message, you can check some of these common trouble situations to help resolve the problem with your custom tutorial.

### ~ hint

#### Tutorial format or content problems

If MakeCode can't load your tutorial, you will likely see the message:

```
Please check your internet connection and check the tutorial is valid
```

This may indicate that your tutorial has a problem with it's content or it can't be located at the path you provided.

### ~

## Tutorial file is too large

Tutorial markdown files are required to be less than **128K** bytes.

### Asset packs in MakeCode Arcade

There can be several images and/or very large images within the asset sections or instructions of a tutorial markdown file. Often these will make the tutorial file size exceed the 128K byte limit. You can reduce the size of the tutorial file by moving the images into a separate asset pack. See the instructions in the [resources](/writing-docs/tutorials/resources) page for creating an [asset pack](/writing-docs/tutorials/resources#creating-asset-packs).

## Tutorial game screen just shows activity spinner

If activity indicator on the game screen in the tutorial seems to just spin and never load, there's probably an error. Start by opening the JavaScript console and try to re-run the tutorial. It should give you an idea of what's causing it to not work.

## Kind types aren't working in MakeCode Arcade

If you added a "kind" and MakeCode generated the code for you, it won't work correctly in the tutorial. You need to add `//% isKind` before each declaration.

The kind that was declared in your tutorial code, such as:

```typescript
namespace SpriteKind {
    export const Veggies = SpriteKind.create()
}
```

You should add `//% isKind` to the declaration:

```typescript
namespace SpriteKind {
    //% isKind
    export const Veggies = SpriteKind.create()
}
```
