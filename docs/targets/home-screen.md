# Home Screen

The home screen is the initial landing place for your users in the code editor. You can control the content displayed on the screen using settings in the two target configuration files: ``pxtarget.json`` and ``targetconfig.json``.

## Hero banner

The "Hero" banner is the top image in the editor. It is specified in the ``pxtarget.json`` file. The image should have dimensions of  ``950 x 300``.  Make sure to include a few blocks in the image since users will recognize those shapes and will associate the page with a block code editor.

```
{
    ...
    "appTheme": {
        "homeScreenHero": "./static/hero.png",
    ...
```

The hero image has a preset location in the page and requires a new release to be updated.

## Galleries #galleries

Gallery contents are defined by entries in markdown files stored in the documentation tree. They can be updated at any time without needing to releasing a new editor. The galleries are displayed on the hero page by:

* the editor downloads the ``targetconfig.json``
* the list of galleries is pulled from the ``galleries`` section which is a map from a Title to a documentation path location. The "classics" example below resolves to the ``/docs/classics.md`` file.

```
    "galleries": {
        "Classics": "classics",
        ...
```

* the gallery contents are downloaded and parsed into a series of cards (the format is described below).

### Shuffling Gallery Items

The order in which the gallery entries appear in the gallery display can be randomized by adding a shuffle
value to the gallery specifier. To do this, replace the single URL string with a two values named ``url`` and ``shuffle``. For ``url``, use the URL from the previous single entry. The ``shuffle`` value deterimes how often the order of the gallery items is changed.

Shuffle values:

* ``daily`` - change the gallery item order once for each day the home screen is viewed

```
    "galleries": {
        "Classics": {
            "url": "/classics",
            "shuffle": "daily"
        },
        ...
```

## Gallery Format

A gallery is a markdown file with one or more ``codecard`` code sections. Each ``codecard`` is formatted
as a JavaScript array of ``CodeCard`` instance.

````
# Classics

## Fun stuff

```codecard
[
{
  "name": "Ping Pong",
  "description": "A game of bouncing ball",
  "url":"/examples/ping-pong",
  "imageUrl": "/static/examples/ping-pong.png",
  "cardType": "example"
},
...
]
```
````

The ``name``, ``description``, ``url``, ``imageUrl`` are mandatory. They are used to display the card in the home screen. A page with a URL that starts with ``https://`` will automatically open in a new tab. If you want to have multiple paragraphs in the description, you can use ``\n`` to separate the description into separate paragraphs:

````
```codecard
[
{
  "name": "Ping Pong",
  "description": "A game of bouncing ball\nThat you can play",
  "url":"/examples/ping-pong",
  "imageUrl": "/static/examples/ping-pong.png",
  "cardType": "example"
},
...
]
```
````

### Card type

The ``cardType`` specifies the kind of resources needed for the gallery item:

#### example

A markdown file that contains a single code ``blocks`` section. It loads the code in the editor.

```
{
    "name": "Super Powers",
    "imageUrl":"/static/mods/fast-forward.jpg",
    "url": "/examples/super-powers",
    "cardType": "example",
    "description": "Make amazing stuff happen!"
}
```

#### tutorial

A markdown file that specifies a sequence of tutorial steps.

```
{
    "name": "Chicken Rain",
    "imageUrl":"/static/mods/chickenrain.jpg",
    "url": "/tutorials/chicken-rain",
    "cardType": "tutorial",
}
```

#### side

Loads a markdown file in the document sidebar.

```
{
  "name": "Autonomous Parking",
  "description": "Design cars that can park themselves safely without driver intervention.",
  "url":"/coding/autonomous-parking",
  "imageUrl": "/static/lessons/autonomous-parking.png",
  "cardType": "side"
}
```

### YouTube videos

Use the ``youTubeId`` field to specify the YouTube video to display on the card. MakeCode will automatically display the video screenshot for it.

```
{
    "name": "Tour of MakeCode",
    "youTubeId": "USSnEhmKnpk"
}
```

### Labels

Use **label** and **labelClass** to control the content and appearance of the label.

```
{
    "name": "Chicken Rain",
    "label": "New? Start Here!",
    "labelClass": "green ribbon huge",
    ...
}
```

### otherActions

If you author tutorials using ``JavaScript`` or ``spy``, MakeCode is able to automatically
render them in JavaScript or Python. Overriding the default language is done in the
``tutorials.md`` page, in the cards section by specifying the ``editor`` field.

If your gallery entry is for a tutorial and your tutorial instructions relate similarly
when using different languages, you can use the ``otherActions`` field. Writing your tutorial in a language agnostic way lets you use a single source document for both JavaScript and Python. 

````
```codecard
[{
    "name": "Chicken Rain",
    "cardType": "tutorial",
    "url": "/tutorials/spy/chicken-rain",
    ...
    "otherActions": [{
        "url": "/tutorials/spy/chicken-rain",
        "editor": "py",
        "cardType": "tutorial"
    }, {
        "url": "/tutorials/spy/chicken-rain",
        "editor": "js",
        "cardType": "tutorial"
    }]
}]
```
````

Leave ``otherActions`` empty to automatically populate options for all language types (Blocks, JavaScript, and Python) for a single tutorial source.

````
```codecard
[{
    "name": "Chicken Rain",
    "cardType": "tutorial",
    "url": "/tutorials/spy/chicken-rain",
    ...
    "otherActions": []
}]
```
````

## Example

Here is an example of a gallery defined for tutorials.

````markdown
# Tutorials

Here are some cool tutorials to get you started with your Gizmo Board!

## Basic

```codecard
[{
  "name": "Flashing Heart",
  "url":"/projects/flashing-heart",
  "description": "Make an animated flashing heart.",
  "imageUrl": "/static/gizmo/projects/a1-display.png",
  "cardType": "tutorial",
  "label": "New? Start Here!",
  "labelClass": "purple ribbon large"
}, {
  "name": "Name Tag",
  "description": "Scroll your name on the screen",
  "imageUrl": "/static/gizmo/projects/name-tag.png",
  "url": "/projects/name-tag",
  "cardType": "tutorial"
}]
```
````

## Hero Gallery

You can specify a gallery in ``pxtarget.json`` that will populate a carousel
in place of the hero image.

```json
{
    "homeScreenHeroGallery": "/hero"
}
```

where ``hero`` is a gallery. Each card will rotate through the hero location on the home screen (only the first 5 cards are displayed). When rendering the cards,

* ``largeImageUrl`` and ``imageUrl`` are used if present,
* ``label`` is used in the button if present; otherwise ``name`` is used
* (future) ``name`` and ``description`` shown above button

## Testing

Before pushing documentation changes, you can run the [checkdocs](/cli/checkdocs) command to validate
that all snippets compile and the format of card is valid.

```
pxt checkdocs
```
