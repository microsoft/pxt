# Arcade release

We are pleased to annouce the first release of MakeCode Arcade! Putting together a fun, educational,
and engaging game developent platform has been a long two year effort, but yet a highly rewarding process
for us. We've had this editor in Beta for quite some time but now we feel it's time to call it ready for
general release. Yea!

## API changes

During the beta phase of Arcade, we learned a lot about how game objects and coding work together
in the MakeCode editor. As a result, we completely revamped the tilemap and sprite editors.
In this post, we'll give you a summary some of the API changes and UI adjustments we made through this
process.

### ~ hint

#### Game Compat

Our latest changes shouldn't change the way your older games run but you will need to use the newer APIs from now on.

### ~

### Tilemap changes

TODO: describe dem tilemap changes

## New Sprite Editor

We've updated the sprite editor with new tools and controls. The editor will also now size itself to fit well
inside the window of your browser or the MakeCode app.

![New sprite editor](/static/blog/arcade/release-12-2019/new-sprite-editor.png)

### Drawing Tools

Three new sprite drawing tools are added. They are the **Circle**, **Line**, and **Canvas Pan** tools.

![New sprite editor](/static/blog/arcade/release-12-2019/drawing-tools.png)

### Undo and Zoom

Along with the **Undo / Redo** controls, we've now added the canvas **Zoom** control so that you can
zoom in to draw those fine details in your images.

![Undo and Zoom controls](/static/blog/arcade/release-12-2019/undo-zoom.png)

### Image Sizer

The **Image Size** control lets you change you sprite's image to the exact width and height that you want.

![Image size control sprite editor](/static/blog/arcade/release-12-2019/image-sizer.png)

## GitHub Integration

To bring in the full power of MakeCode GitHub Integration, a **GitHub** button is now present right next
to the **Save** button. Now you can have your project's changes synced to/from GitHub with just a button
click. If you haven't learned about our new GitHub integration, read about it starting with this [blog post](/blog/github-packages).

![GitHub button](/static/blog/arcade/release-12-2019/github-integrate.png)

## New Look for the Simulator

To make the UI for Simulator be a bit more appealing, we've styled the buttons, rounded the corners,
and softened it's colors.

![New simulator UI skin](/static/blog/arcade/release-12-2019/new-sim-ui.png)
