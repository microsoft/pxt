# User Tutorials

This guide explains how users can publish their own [tutorials](/writing-docs/tutorials) on the MakeCode editor.

There are 2 ways of sharing a tutorial: using a shared script or using a [GitHub](https://github.com) repository.

## Authoring

Author the tutorial content in the **README.md** file in your project. The format is the same as documented in [tutorials](/writing-docs/tutorials). 

The dependencies are used when starting the tutorial project, but code content (``main.blocks``, ``main.ts``) is ignored.

### ~ hint

You can access ``README.md`` through by switching to **JavaScript**, then **Explorer**, then click on **README.md**.

### ~

## Share

The easiest way to share a tutorial is to share the program and use the shared project url as follows

    https://[editor url]/#tutorial:[shared project url]

* where ``editor url`` is the editor dmain, like ``makecode.microbit.org``
* where ``shared project url`` is the url give to you by MakeCode after sharing, ``https://makecode.com/_somefunnyletters``.

## GitHub repository

If you plan to update your tutorial over time, we recommend to store your project in a GitHub repository. In such case, the URL to open the tutorial directly takes the full GitHub repository URL:

        https://[editor url]/#tutorial:[GitHub repository url]

## Report Abuse and approvals

By default, all tutorials opened from a user shared project or GitHub repository will have a **Report Abuse** button. If you whish to avoid this button, use the GitHub project approach and get the repository approved.