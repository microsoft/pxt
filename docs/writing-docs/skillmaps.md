# Skillmaps

A skillmap is is one or more guided pathways with focused learning objectives along the way. The goal of a skillmap is to have students progrerssively aquire a set of design and coding skills until they reach an achievement goal.

### ~ reminder

#### Skillmap support in MakeCode

Currently, skillmaps are supported only in [MakeCode Arcade](https://arcade.makecode.com/--skillmap).

### ~

![Skillmap intro graphic](/static/skillmaps/skillmap-intro.jpg)

### ~ hint

#### Sample skillmap

For an example, you can take a look at the [**Skillmap Sample**](https://github.com/microsoft/pxt-skillmap-sample). Use it as a template to start your own!

First though, you should [try out](https://arcade.makecode.com/--skillmap#github:microsoft/pxt-skillmap-sample/skillmap) the sample to see how it works.

### ~

## Skillmap paths

A skillmap path has a starting point and a sequence of nodes (activities) to progress through. The activities in nodes along the path are locked until the previous node's activity is finished.

![Individual skillmap path](/static/skillmaps/skillmap-path-intro.jpg)

The first node is unlocked and ready to start.

![Skillmap start node](/static/skillmaps/skillmap-start-node.jpg)

Each node contains a tutorial exercise to teach a certain skill or concept. Completing the tutorial (activity) will unlock the next node along the pathway. 

![Skillmap completed node](/static/skillmaps/skillmap-complete-node.jpg)

After the last tutorial node, the student reaches the end of the path on the map and arrives at the Reward. The Reward node greets the student with an affirming message and awards them a downloadable "Certificate of Completion".

![Skillmap start node](/static/skillmaps/skillmap-reward-node.jpg)

### Skillmap structure

A skillmap is described by a markdown document with sections for the map settings, its paths, and the activities (nodes) in the paths.

```
# map-id

* mapProperty1: ...
* mapProperty2: ...

## path-id1

* pathProperty1: ...

### path-id1-activity1

* activityProperty1: ...
* activityProperty2: ...

### path-id1-activity2

## path-id2

### path-id2-activity1

### path-id2-activity2

### path-id2-activity3
```

The first-level (`#`) heading is the ID of the skillmap. Under this heading are the map's properties. A skillmap document has one or more _paths_ declared under the second-level (`##`) headings. The path sections contain a set of _activities_ that form the path. The activities for a path are under third-level (`###`) headings.

Each activity section has list of properties. All activities have a `name`, a `description`, and a `type`, along with other properties which are related to the `type` of the section.

```
### space-cruiser-activity1

* name: Space background
* description: Create a stellar background image.
* type: tutorial
```

### Map properties

The map properties are in the first section of the skillmap document. This starts with a first-level (`#`) heading using the skillmap's name, or its the _map-id_.

* **map-id**: the identification name of the skillmap

```
# game-maker-guide
```

Following the heading is a bulleted list of the properties defined for the skillmap.

* **name**: map display name
* **description**: map description
* **infoUrl**: URL to an external resource page, educator info, etc. (not presently used)
* **backgroundurl**: URL to the background image
* **bannerurl**: URL to the banner image (displayed in the sidebar when nothing is selected) 
* **primarycolor**: hex color value for path and locked nodes (slightly translucent)
* **secondarycolor**: hex color value for unlocked nodes
* **tertiarycolor**: hex color value for background
* **highlightcolor**: hex color value for the selected node border and unlocked reward nodes
* **alternatesources**: combine progress info from the skillmap URL linked here into the progress stats for this skillmap

A property list from a skillmap in MakeCode Arcade provides an example:

```markdown
# game-maker-guide

* name: Game Maker Guide
* description: Level up your game making skills by completing the tutorials in this guide.
* infoUrl: skillmap/educator-info/int-map-info
* bannerUrl: /static/skillmap/platformer/activity4.png
* backgroundurl: /static/skillmap/space/game-maker-guide-background.png
* primarycolor: #2EA9B0
* secondarycolor: #F392BD
* tertiarycolor: #83C252
* highlightcolor: #FAED28
* alternatesources: github:https://github.com/microsoft/pxt-skillmap-sample/skillmap.md
```

The following skillmap has 3 different paths defined. The panel on the right shows the name of the map with a description and a banner image.

![Full skillmap graphic](/static/skillmaps/skillmap.jpg)

### Path properties

The path properties are in the second-level (`##`) headings using the paths's name, or its _path-id_.

* **path-id**: the identification name of the path

```
## space
```

After the heading is the path property list.

* **name**: path display name
* **description**: the path description

Here's an example of a property list set for a path:

```
## space

* name: Design a Space Explorer
* description: Let's explore the depths of space! We'll design a vessel for space travel, add some enemies, and populate the universe with planets.
* completionUrl: /static/skillmap/certificates/design-a-space-explorer.pdf
```

### ~ hint

#### Selecting a path

When selecting a path in a skillmap, the focus goes to the activity node. That node's properties are displayed along with the path description.

### ~

The selected path shows in the skillmap panel along with the property info from the activity node in focus.

![Individual skillmap path](/static/skillmaps/skillmap-path.jpg)

### Activities (tutorial nodes)

An activity node sets a current activity and connects it to the next one. Activities are created as [tutorials](/writing-docs/tutorials) and linked together in the node properties.

The activity node properties are under a third-level (`###`) heading which has the nodes's name, or its _node-id_. The activity nodes are grouped sequentially under their associated path section.

* **node-id**: the identification name of the node

```
### space-activity3
```

The node properties are specified under the `node-id` heading.

* **name**: the display name of the activity node
* **description**: description of the activity
* **type**: the type of node, for activities use `tutorial`
* **tags**: a tag list to categorize the activity, like: `easy, enemies`
* **next**: the `node-id` of the next activity
* **url**: the URL for the tutorial document
* **imageUrl**: a url for an image to display in the panel: jpg, png, or gif
* **allowcodecarryover**: this is `true` by default, you can turn it off by setting it to `false`
* **kind**: `layout` (reservedor `completion` (reserved, don't use)

The node with it's properties will look like this:

```
### space-activity3

* name: Enemies
* description: Watch out for danger! Add enemies and lives to your game.
* type: tutorial
* tags: easy, enemies, kinds
* next: space-activity4

* url: /skillmap/space/activity3
* imageUrl: /static/skillmap/space/enemies.gif
```

The node `name`, `description`, and `tags` are shown in the skillmap panel.

![skillmap node](/static/skillmaps/skillmap-node.jpg)

### Rewards (completion nodes)

Reward nodes are at the same level as activities. The node completes a path and displays the reward certificate. Set these properties for the reward node:

* **type**: the type of node, for a reward node use `certificate`
* **kind**: the kind for this `type` of node, use `completion`
* **url**: the URL path to a certificate document (i.e. the "Certificate of Completion")

Here's a sample reward node:

```
### space-finish

* type: certificate
* kind: completion
* url: https://microsoft.github.io/pxt-skillmap-sample/certificates/design-a-space-explorer.pdf
```

![skillmap reward node](/static/skillmaps/skillmap-reward.jpg)

## Loading a skillmap

Skillmaps are loaded into a MakeCode editor using a URL with the `skillmap` resource type. Using https://arcade.makecode.com/--skillmap will load the default skillmap for MakeCode Arcade. To load skillmaps from somewhere else, append an external resource address path to this URL. To use a skillmap from the [Skillmap Sample](https://github.com/microsoft/pxt-skillmap-sample) repository in GitHub, specify it with a direct path to the skillmap document file.

Connect `https://arcade.makecode.com/--skillmap` with the GitHub resource specifier as a parameter using `#`. So, you have `https://arcade.makecode.com/--skillmap` + `#` + `github:microsoft/pxt-skillmap-sample/skillmap`. This forms the full skillmap load URL:

https://arcade.makecode.com/--skillmap#github:microsoft/pxt-skillmap-sample/skillmap
