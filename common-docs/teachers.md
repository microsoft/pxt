# Features for Teachers

This is a list of lesser known features that teachers have found useful when using MakeCode.

## Printing and Snapshots

If you want to include examples of code in printed materials, there are two good ways to do this:

### Printing

In the editor, you can print the current project you are working with by clicking the cogwheel in the top right corner and selecting `Print`.
This will produce a view of the code from your project that is printer friendly.

![Animation showing how to print](/static/teachers/how-to-print.gif)

### Snapshot

You can save a ``.png`` file with an image of all the blocks in your current projects using the ``Snapshot`` feature.
Right click on the Workspace (press and hold on touch devices) and select **Snapshot**.

![Animation showing how to take a snapshot](/static/teachers/how-to-snapshot.gif)

## Sharing

You can create links to share your project using the ``Share`` button in the top left corner of the editor.

![Animation showing how to share a project](/static/teachers/how-to-share.gif)

### Embed

If you have a class website that supports adding ``HTML`` elements to web pages,
you can embed the simulator, code, or the full editor from the share screen.

![Animation showing how to embed a project](/static/teachers/how-to-embed.gif)

## Tutorials

Tutorials are examples that guide students through the process of creating programs step by step,
using just the features and blocks limited what is most important.
Typically, the first examples on the home page are tutorials.
They help introduce students to the concepts they need to write simple programs.

### Writing your own

If you want to create your own examples for your students to follow,
you can [create a tutorial yourself](https://makecode.com/writing-docs/user-tutorials)!

### Sharing a tutorial

If you are using a tutorial in a class,
it may be helpful to give your students a link that goes directly to the tutorial.
Instructions to do this are available in the [FAQ](/faq#share-tutorials).

## Classroom

These features are specially designed to be used in a classroom.

## Green screen

You can enable the ``Green Screen`` feature from the cogwheel menu in the editor. It will render the video stream of a webcam on the background of the code editor. Great to mix coding and filming the device.

## Courses

Many editors include free courses that you can use in your class;
if you want to print or save these courses, you can use a special url to convert
the entire course into a single page. The format for this is:

    https://[editor url]/--docs#book:/[course location under the docs folder]

For example, here are the steps to create a 'book' view of an introductory course
for MakeCode Arcade. The course is found at https://arcade.makecode.com/courses/csintro1,
so the first step is to split that into two parts: the editor url (`https://arcade.makecode.com`)
and the location of the course (`/courses/csintro1`).

To get the course book, you combine the two with `/--docs#book:` in between them:

    https://arcade.makecode.com/--docs#book:/courses/csintro1

and after a few moments of compiling the page, you should have a complete printable book for the course!

## GitHub

MakeCode support storing projects in [GitHub](/github), a popular web site for hosting code and collaborative software development.
The [GitHub Explorer](https://makecode.com/github-explorer) allows to list and review repositories from a user seamlessly.