# Home Screen

The home screen is the landing place for your users in the code editor. You can control the content displayed on the screen using information in ``pxtarget.json`` and ``targetconfig.json``.

## Hero banner

The "Hero" banner is the top image in the editor. It is specified in the ``pxtarget.json`` file. The image should be wide ``950 x 300``.  Make sure to have a few blocks on the image as users recognize those shapes.

```
{
    ...
    "appTheme": {
        "homeScreenHero": "./static/hero.png",
    ...
```

The hero image location is hard-coded in a release and requires a new release to be updated.

## Galleries

The galleries are populated from Markdown files stored in the documentation. They can be updated on the fly without releasing a new editor. The population of the hero page runs as follow:

* the editor downloads the ``targetconfig.json``
* the list of galleries is pulled from the ``galleries`` section which is a map from a Title to a documentation path location. For example "classics" below, resolves to the ``/docs/classics.md`` file.

```
    "galleries": {
        "Classics": "classics",
        ...
```

* each gallery page content is downloaded and parsed into a series of card. We'll cover the format below.

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
```
````

The ``name``, ``description``, ``url``, ``imageUrl`` are mandatory. They will be used to display the card in the home screen. A URL that points to ``https://`` will automatically open in a new tab.

The cardType specifies the kind of resources that needs to be opened:

* **example**: a markdown file that contains a single code ``blocks`` section. It loads the code in the editor.
* **tutorial**: a markdown file that specifies a sequence of tutorial steps
* **side**: loads a markdown file in the side docs
