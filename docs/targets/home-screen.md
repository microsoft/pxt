# Home Screen

The home screen is the landing place for your users in the code editor. You can control the content displayed on the screen using settings in ``pxtarget.json`` and ``targetconfig.json``.

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

## Galleries

Gallery contents are defined by entries in markdown files stored in the documentation tree. They can be updated at any time without needing to releasing a new editor. The galleries are displayed on the hero page by:

* the editor downloads the ``targetconfig.json``
* the list of galleries is pulled from the ``galleries`` section which is a map from a Title to a documentation path location. The "classics" example below resolves to the ``/docs/classics.md`` file.

```
    "galleries": {
        "Classics": "classics",
        ...
```

* the gallery contents are downloaded and parsed into a series of cards (the format is described below).

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

The ``name``, ``description``, ``url``, ``imageUrl`` are mandatory. They are used to display the card in the home screen. A page with a URL that starts with ``https://`` will automatically open in a new tab.

The ``cardType`` specifies the kind of resources needed for the gallery item:

* **example**: a markdown file that contains a single code ``blocks`` section. It loads the code in the editor.
* **tutorial**: a markdown file that specifies a sequence of tutorial steps.
* **side**: loads a markdown file in the document sidebar.
