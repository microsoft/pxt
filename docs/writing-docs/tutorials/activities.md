# Activity tutorials

Rather than have multiple tutorials for related activities, a tutorial can use the _activity_ format to progress to further activities in the same tutorial. Activities each have their own set of steps to complete.

## Enable activites

To have the tutorial engine interpert the sections in the tutorial as activities with steps, use the **@activities** metadata option at the top of the page.

```
### @activities 1

```

**Note**: You can use either the literal of `1` or `true` to turn on activities.

## Activity format

Instead of a linear progression of steps as in the default format, an activity tutorial uses a heading - subheading structure to divide up each activity and its steps.

### Default step structure

The default tutorial structure simply progresses through a series of steps.

```
## Introduction
## Step 1
## Step 2
## Step 3
## Finish
```

### Activity step structure

The activity tutorial structure uses a two-level layout - activity and steps, next activity.

```
### @activities 1

## Introduction

### Introduction step

## Activity 1

### Step 1
### Step 2

## Activity 2

### Step 1
### Step 2
### Step 3

## Activity 3

### Step 1
### Finish
```

### Title

In an activity style tutorial, the title can appear in a psuedo-activity that serves as an introduction. The title is also displayed in the tutorial control bar.

```markdown
### @activities true

## Introduction

### Introduction step @showdialog

![Lights flashing](/static/tutorials/light-blaster/flashing-lights.gif)

# Light blaster

The amazing blast of bright light! Make a program to flash the LEDs.
```

### Activity sections

An activity begins with a _level 2_ heading (``##``) followed by the activity name. The activity name is displayed in the tutorial control bar next to the step progress counter and step advance controls. An activity can have any number of steps, but no activity-specific text.

```markdown
## Activity 1

### Step 1

Instructions for step 1 of activity 1 here...

### Step 2

Instructions for step 2 of activity 1 here...

## Activity 2

### Step 1

Instructions for step 1 of activity 2 here...
```

### Step syntax

If the tutorial has **activities** enabled in the metadata, steps begin with a _level 3_ heading (``###``), followed by the name.

The text in the heading is shown only when the tutorial is viewed as a help page. It's ok to have additional text in the heading. The word 'Step' can even be left out since the tutorial runner will build the list of steps only from the content under the heading tag, ``###``. These are valid headings:

```markdown
### Step 3: Make a new variable
```

>--or--

```markdown
### Flash all the LEDs on and off twice
```

The editor automatically parses the markdown and populates the user interface from each step section.


