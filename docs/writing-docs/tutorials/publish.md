# Publish

Tutorials are often written as part of a MakeCode or other PXT based editor (by the editor developers) and exist directly on the editor's website. Other tutorials are created by users and saved as MakeCode projects or in a GitHub repository.

## User or "Third-Party" tutorials

If you have a tutorial that is in a project or a GitHub repository, see the instructions in [User Tutorials](/writing-docs/user-tutorials) about how to publish it.

### ~ alert

#### Tutorial caching

MakeCode uses a local caching policy for tutorials to reduce interaction with website services. On first use, tutorial content is retrieved from a MakeCode website and then then reused from the local cache when a tutorial is run another time. A requested tutorial will refresh from the website when its cache retention period expires.

This caching policy can present a problem if you're developing a tutorial and want to review the recent changes. When you run the tutorial to check your changes, they might not appear and you only see content you viewed the first time. In order to see and test new changes you've published for your tutorial, it's recommended that you view them in a **new anonyomous / incognito** browser window.

### ~

## Tutorial locations in editor targets

The tutorials included as part of an editor target can be located anywhere under the ``/docs`` folder. They typically are placed in a ``/docs/tutorials`` folder though.

A tutorial with the title '**Light blaster**' might have a path like this: _/docs/tutorials/light-blaster.md_.

## In-Context Tutorials

In context tutorials are tutorials that are loaded into an existing project, rather than into a blank one. The format is the same as for all tutorials. If you are writing a third-party tutorial, please see the [User Tutorials](/writing-docs/user-tutorials) documentation for information on how to share your content as an in-context tutorial.

For editor maintainers:

* Add ``recipes: true`` in the ``appTheme`` section of your [``pxtarget.json``](/targets/pxtarget#apptheme-apptheme) to enable in-context tutorials
* Optionally add a ``/docs/recipes.md`` file that contains a list of code cards referencing your in-context tutorials.

In order to select the proper language (blocks vs JavaScript vs Python), you should add
a ``"editor": "js"`` entry for JavaScript tutorials and ``"editor": "py"`` entry for Python tutorials to each code card.

## Adding tutorials to the home screen

To have a tutorial appear on the home screen, you will need to create or use an existing gallery and add a tutorial entry to it. See the
[home screen](/targets/home-screen#galleries) page for information about creating and adding to home screen galleries.

## Translations

Tutorials for MakeCode editors are translated via [Crowdin](/translate) like any other documentation page.
