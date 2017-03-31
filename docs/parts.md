
# Parts definition

When is necessary to expose external components in the simulator that work together with the board (leds, sensors, speaker, headphone, etc.), it can be done by specifying the JSON definition of the part in the *pxtparts.ts* file using the following arguments:

* **simulationBehavior** *(optional)*: built-in simulator logic name
* **numberOfPins**: total number of pins including power, GPIO and other pins
* **visual**: visual description or built-in visual name
    1. **image** (optional):  URL to image asset
    2. **builtIn** (optional): or name of built-in part visual
    3. **width, height**: description of a parts visual; units don't matter but must be internally consistent
    4. **pinDistance**: the distance between the centers of two adjecent pins; used to scale part for breadboard
    5. **pinLocations**: the exact centers of each pin; must have as many locations as the "numberOfPins" property
* **pinDefinitions**: metadata for each pin
    1. **target**: e.g.: "ground", "MISO", "threeVolt", etc.
    2. **style**: e.g.: "male", "female", "solder". 
    3. **orientation**: e.g.: "+X", "-Z", etc.
    4. **colorGroup**(optional): if set, the allocator while try to give pins for this part in the same group the same color
* **instantiation**: description of how part is instantiated
* **assembly**: list describing number and order of assembly instruction steps; the length is how many steps this part needs

## Exposing a static component

We define a static component as a component who does not have a simulation behavior and only needs to be exposed e.g.: speaker, headphone jack. <br/>
To show these components it is necessary to include the *image* argument in the *visual* description with the corresponding SVG file path. <br/>
<br/>

**Example:**

```json
"visual":
{
    "image": "parts/speaker.svg",
    "width": 90,
    "height": 100,
    "pinDistance": 15,
    "pinLocations": [
     {"x": 30, "y": 0},
     {"x": 60, "y": 0}
     ]
}
```

## Exposing a dynamic component

A dynamic component is a component who has a simulation behavior, that means that its visual aspect changes according to the state of the component.
these components are implemented using two classes:

1. **State class**:  Controls the state of a component e.g.: on, off, brightness level, resistance level, etc.
2. **Visual class**: Controls the visual aspect of the image

The JSON definition of this kind of component is quite different, we **SHOULD NOT** include the *image* argument in the *visual* definition but it is necessary to include the *simulationBehavior* argument to specify to PXT what are the classes (state and visual) that are going to manage the behavior of this part.

## Exposing an only-state change component

There are several components like analog sensors that change their functionality per electrical or physical changes of the environment where they are, but those changes do not represent a visual modification of the component.

In PXT We can expose these components together with a slider that can simulate the different scenarios to which the physical device can face, like light level, sound level, pressure level, moisture level, temperature level, etc. To do this, we need to create de same visual definition we use for a static component but now we must add the *simulationBehavior* argument to specify that we are going to use the SVG image together with the type “dial” component clarifying what is the range value of our component by setting *min* and *max*, After that we can see the SVG image next to a vertical slider that can move between these two values.

**Example:**
```json
"simulationBehavior":
{
    "type": "dial",
    "min": "0",
    "max": "80"
}
```
In this case the full part definition will look like:<br/>

```json
"lightSensor":
{
    "numberOfPins": 2,
    "visual": {
        "image": "parts/light.svg",
        "width": 100,
        "height": 200,
        "pinDistance": 15,
        "pinLocations": [
            {"x": 40, "y": 15},
            {"x": 48, "y": 15}
        ]
    },
    "pinDefinitions": [
        {"target": "P1", "style": "croc", "orientation": "-Z"},
        {"target": "threeVolt", "style": "croc", "orientation": "-Z"}
    ],
    "instantiation": {"kind": "singleton"},
    "assembly": [
        {"part": true, "pinIndices": [0]},
        {"pinIndices": [1]}
    ],
    "simulationBehavior":{
        "type": "dial",
        "min": "0",
        "max": "100"
    }
}
```
