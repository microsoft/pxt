# User tutorials

This guide explains how users can publish their own [tutorials](/writing-docs/tutorials) for the MakeCode editor.

There are 2 ways of sharing a tutorial: use a shared script or publish it in a [GitHub](https://github.com) repository.

### #youtubegithub

https://youtu.be/XsM8hp7eysA

## Authoring

Author the tutorial content in a **Markdown** file in your project. The format is the same as what's documented in [tutorials](/writing-docs/tutorials). 


### ~ hint

#### Edit README.md

You can access ``README.md`` in the editor. Switch to **JavaScript**, go to **Explorer**, and then click on **README.md**.

### ~

## Share

The easiest way to share a tutorial is to first share the program. Then, use the shared project url combined with editor url and the ``#tutorial:`` specifier.

    https://[editor url]/#tutorial:[shared project url]

* where ``editor url`` is the editor domain, like ``makecode.microbit.org``
* where ``shared project url`` is the url give to you by MakeCode after sharing, ``https://makecode.com/_somefunnyletters``.

The complete shared url is formatted like:

    https://makecode.microbit.org/#tutorial:https://makecode.com/_sIty7Iop

### Project dependencies

The dependencies for a shared tutorial project are used when the tutorial starts. The project code content (``main.blocks``, ``main.ts``) is ignored though. This also includes the code in ``custom.ts``! If you are hoping to include custom blocks in a tutorial, put them in an extension first, then that extension can get added to the project's dependencies. Read more about making [extensions](/extensions/getting-started/).

### ~ alert

#### Tutorial caching

MakeCode uses a local caching policy for tutorials to reduce interaction with website services. On first use, tutorial content is retrieved from a MakeCode website and then reused from the local cache when a tutorial is run another time. A requested tutorial will refresh from the website when its cache retention period expires.

This caching policy can present a problem if you're developing a tutorial and want to review the recent changes. When you run the tutorial to check your changes, they might not appear and you only see content you viewed the first time. In order to see and test new changes you've published for your tutorial, it's recommended that you view them in a **new anonyomous / incognito** browser window.

### ~

## GitHub repository

If you plan to update your tutorial over time, we recommend storing your project in a GitHub repository. With a repository, the URL to open the tutorial takes the full GitHub repository URL:

    https://[editor url]/#tutorial:[GitHub repository url]

For example,

    https://makecode.microbit.org/#tutorial:https://github.com/myorg/myrepo

### Multiple tutorials per repository

You can override the markdown file from the project used for the content of the tutorial (default is ``README.md``) by adding the path to the query argument (``.md`` not needed)

    https://[editor url]/#tutorial:[GitHub repository url]/[filename]

where MakeCode will load the ``filename.md`` file from the project. Don't forget to add this file in the
``files`` list in ``pxt.json``.

For example,

    https://makecode.microbit.org/#tutorial:https://github.com/myorg/myrepo/mytutorial

### Examples

You can also use the ``#example`` route similarly to ``#tutorial`` to load a markdown example into the editor.

    https://[editor url]/#example:[GitHub repository url]/[filename]

### In Context Tutorials

In context tutorials, sometime referred to as "recipes", are tutorials that are loaded into an existing project, preserving the code the user has already written. They use the ``#recipe`` route to load into the editor. Make sure that the editor (that is, "Arcade", "Minecraft", "Microbit", etc) has in-context tutorials enabled in the settings--you may need to contact the editor maintainer to check if this is the case.

    https://[editor url]/#recipe:[GitHub repository url]/[filename]

### Testing

Click on the ``lab`` icon in the **Explorer** view to open any markdown file (``.md``) as a tutorial in a new tab.

### ~ alert

#### Cloud caching

To increase performance, the MakeCode websites may "cloud cache" the release version of a previously used extension and tutorials hosted in a user GitHub repository. This means that if you commit changes to a tutorial you have in a repostory, those updates might not appear when you try to test the tutorial in MakeCode. The MakeCode cloud cache will not reflect your changes until you **create a new release version** for your repository. Making a new release will force the cache to clear the prior version and refresh to the new version the next time it's requested. See [GitHub releases](https://arcade.makecode.com/github/release) for more about creating a versioned release.

Again, to be clear, you need to make the release through the [Github integration](https://makecode.com/extensions/github-authoring) on the MakeCode website. Making a release directly on github.com does _not_ force the cache to clear.

### ~

### Localization

Localized copies of the tutorial can be added to a subfolder ``_locales/[isocode]/[filename].md`` 
where ``filename`` is the name of the tutorial in the default locale. ``icocode`` can be the 
region specific language code or language neutral. MakeCode will pick the best match.

#### #youtubeloc

https://youtu.be/3LKmE0c5UZU

### Repository with custom blocks

If the tutorial repository contains JavaScript files (``.ts``),
it will automatically be added to the dependencies of the 
program used during the tutorial. This allows you to package custom blocks
in your tutorials or teach your extensions via tutorials.

It's important to know that tutorial project includes any code you might have in ``main.ts``. So, if you've built a sample program while making the tutorial, make sure to move the code into another project or delete it before sharing the tutorial. If ``main.ts`` has any code in it, the code will run when the tutorial gets opened!

## Report abuse and approvals

By default, all tutorials opened from a user shared project or GitHub repository will have a **Report Abuse** button. If you would rather not have this button appear, use the GitHub project approach and get the repository approved.
