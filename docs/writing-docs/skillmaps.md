# Skillmaps

A skillmap is is one or more guided pathways with focused learning objectives along the way. The goal of a skillmap is to have students aquire a set of design and coding skills related to creating programs and games.

![Skillmap intro graphic](/static/skillmaps/skillmap-intro.jpg)

## Skillmap paths

A skillmap has a starting point and a sequence of nodes (objectives) to progress through.

![Individual skillmap path](/static/skillmaps/skillmap-path-intro.jpg)

The first node is unlocked and ready to start.

![Skillmap start node](/static/skillmaps/skillmap-start-node.jpg)

Each node contains a tutorial exercise to teach a certain skill or concept. Completing the tutorial will unlock the next node along the pathway. 

![Skillmap completed node](/static/skillmaps/skillmap-complete-node.jpg)

After the last tutorial node, the student reaches the end of the path on the map and arrives at the Achievement. The Achievement rewards the student with an affirming message and awards them with a downloadable Certificate of Completion.

![Skillmap start node](/static/skillmaps/skillmap-reward-node.jpg)


### Skillmap structure

A skillmap is described in sections and attribute lists in a markdown document.

![Full skillmap graphic](/static/skillmaps/skillmap.jpg)

### Map properties

The map properties are in the first section of the skillmap document. This starts with a top-level heading using the skillmap's name, or its the _map-id_:

```
# game-maker-guide
```

Following the heading are a bulleted lis of the properties defined for the skillmap.

* **name**: Map Display Name
* **backgroundurl**: URL to the background image
* **bannerurl**: URL to the banner image (displayed in the sidebar when nothing is selected) 
* **primarycolor**: Hex color for path (slightly translucent), locked nodes
* **secondarycolor**: Hex color for unlocked nodes
* **tertiarycolor**: Hex color for background
* **highlightcolor**: Hex color for selected node border and unlocked reward nodes
* **allowcodecarryover**: this is true by default, you can turn it off by setting it to "false"

A property list from a skillmap in MakeCode Arcade provides an example:

```markdown
# Game Maker Guide

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

![Individual skillmap path](/static/skillmaps/skillmap-path.jpg)

![skillmap node](/static/skillmaps/skillmap-node.jpg)

EMPTY NODE (This one is meant for internal use only, documenting it here for completeness): 
The name does not matter, and this node cannot have children

### node-id
* name: Blank node
* kind: layout

REWARD NODES: 
Right now the "kind" has to be "completion" (trophy node at the end of the graph) and the only supported type is "certificate". They can have images as well.

### node-id
* kind: completion
* type: certificate
* url: https://path-to-certificate.pdf

![skillmap reward node](/static/skillmaps/skillmap-reward.jpg)

ASSET EDITOR TUTORIALS: 
This is slightly separate but it is in /beta for testing! Add this to the top of a tutorial to have it open in the asset editor.

`### @preferredEditor asset`

I think this is the most complete markdown file currently, it’s not meant as a sample but we’ve been using it for testing: https://github.com/shakao-test/demo/blob/master/sample.md
Which can be loaded at: http://arcade.makecode.com/beta--skillmap#github:https://github.com/shakao-test/demo/sample
