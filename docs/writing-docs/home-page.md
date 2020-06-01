# Home Page

## Listing on the home screen

To have a tutorial appear on the home screen, you will need to create or use an existing gallery and add a tutorial entry to it.

### Defining galleries

Tutorials typically appear as cards on the [home screen](/targets/home-screen#galleries). Each card category is a markdown file that is referenced from the ``targetconfig.json`` file. The ``galleries`` section in the configuration specifies a map of gallery titles to gallery markdown file paths. You can have as many galleries as you wish to organize your tutorials.

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

```
{
    ...
    "galleries": {
        "Tutorials": "projects/tutorials",
        "Games": "projects/games",
        ...
    }
}
```

Also, add a direct link to the tutorial in the ``SUMMARY.md`` page to help search engine bots.

### ~ hint

#### A real example

See the micro:bit config https://github.com/Microsoft/pxt-microbit/blob/master/targetconfig.json

### ~

#### Authoring the gallery

A gallery entry for a [tutorial](/targets/home-screen#tutorial) is placed in the markdown file mapped to the category. For the example above, it's in _/projects/tutorials.md_.

The gallery is defined by authoring ``codecards`` in the markdown section. Each ``codecard`` has the following fields:

* **name**: tutorial name
* **imageUrl**: an optional icon image
* **url**: tutorial document path
* **cardType**: set to "tutorial"
* **description**: description of what the tutorial does

Here's an example entry in _tutorials.md_:

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

The tutorial document tree has this layout:

```
/docs/projects/tutorials.md
/docs/projects/flashing-heart.md
/docs/projects/name-tag.md
...
```

### ~ hint

#### A real example

See the micro:bit tutorial gallery https://github.com/Microsoft/pxt-microbit/blob/master/docs/tutorials.md

### ~
