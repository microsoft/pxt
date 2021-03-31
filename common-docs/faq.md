# Frequently Asked Questions

### @description Frequently asked questions and answers from our users.

## Which web sites do I need to unblock for @homeurl@? #unblock

Access to certain domains is necessary to allow the web editor to reach all the resources it needs to fully function. These are the domains to unblock:

* @homeurl@
* https://makecode.com
* https://trg-@targetid@.userpxt.io
* https://pxt.azureedge.net
* https://api.github.com
* https://immersivereaderprod.cognitiveservices.azure.com

To enable some additional features for extension developers, the following domains are also needed. In most cases, you won't need to unblock these domains:

* https://github.com
* https://raw.githubusercontent.com/

## Where are my projects saved?

Projects are kept in the browser's local indexed data store. You can save your project with a name. If you don't name your project, it's kept as an "Untitled" project. You can also save your project to a file or in the cloud.

Read more about [saving](/save) projects.

## Can I restore a previous version of my project?

Yes! Go to the GitHub view and click on ``View commits`` in the [History](/github/history) section.
You can review each commit and select to restore your project to that commit.

## Can I use MakeCode when I'm not connected to the internet? #work-offline

Some MakeCode editors are available as [offline apps](/offline). Also, when MakeCode first loads in the browser, a cached version of MakeCode is stored automatically. If later you want to add an extension to use with your program, you will need to connect again. For more information see the page about using MakeCode [offline](/offline).

## Can I use Extensions when I'm not connected to the internet?

Yes, it is possible to save Extensions so that your programs can still use them when you're offline. Follow [these instructions](/offline#extensions).

## What happens when I clear the browser's cache and temporary files? #clear-data

When you clear browsing data, all of the saved projects and files that support MakeCode working offline are removed. Any project that you've shared to the public cloud is still there.

## Where does a project that I share go? #sharing

When you share a project it's saved to the public cloud for MakeCode. Anyone can see your project if they have its shared URL.

## What are some additional ways I can share projects with teachers and friends? #share-options

* Use the share button to publish your project to the MakeCode cloud. You can send the share URL that's created to anyone.
* The share URL can be pasted into a OneNote page or inserted as an embedded link on a website. In some cases, the link will be automatically expand into a read-only editor view of your project.
* You can save the project and copy it to a class website or to an approved location on the class or school network.
* You can copy code from and paste code into the JavaScript view of the editor. This let's you move code between MakeCode and other applications on your computer or device.

## Why does the editor still use the previous project name if I renamed the download file?

When you download the program for your project, the name you gave the project becomes part of the download file. If you decide to rename the download file, the name you chose for the project, not the current filename, is used and displayed by the editor.

## I just added / approved a new translation in Crowdin, when will it show up?

[Translations](https://makecode.com/translate) are managed by the [Crowdin](https://crowdin.com/project/kindscript) site. There's a scheduled process which checks for new translations in Crowdin and brings them down to the website serving a MakeCode editor. The process usually takes 10 - 30 minutes from when a new translation is approved to when it will appear in an online editor.

## Where is the "Add Package" button?

Packages were renamed to **Extensions** to align with other code editors. You will now find the **Extensions** menu selection that replaces the **Add Package** button.

## How can I share tutorials? #share-tutorials

Tutorials load in the editor, which can make them tricky to share.
If you want to make a direct link to a tutorial, you need to find the location of the tutorial in the target's documentation. From there you can create a link that goes directly to the tutorial.
For example, to make a link to micro:bit's `Flashing Heart` tutorial, you need to...

1. Find the tutorial in the documentation: [https://makecode.microbit.org/projects/flashing-heart](https://makecode.microbit.org/projects/flashing-heart).
2. Take that url, and split it into two parts: the main domain (`https://makecode.microbit.org`), and the location of the tutorial (`/projects/flashing-heart`).
3. In between those two pieces, add `/#tutorial:`: [https://makecode.microbit.org/#tutorial:/projects/flashing-heart](https://makecode.microbit.org/#tutorial:/projects/flashing-heart).

If you're looking at the GitHub repository for the target, the link will be the following:

    https://[editor url]/#tutorial:/[tutorial location under the docs folder]

If you want to create your own tutorial, more documentation describing how to do so is [here](https://makecode.com/writing-docs/user-tutorials).

## I am a teacher. Is there anything special I should know?

Yes! We have prepared a list of tips and tricks for teachers. [Check it out](/teachers).

## How do I choose the folder where my downloaded projects are saved?

Most browsers will let you turn on a setting to require the browser to first ask you where you want to save your files before they are downloaded.

* On Microsoft Edge you open the browser menu and select **Settings**. In the "General" settings pane, scroll down to the **Downloads** section. Turn **ON** the "Ask me what to do with each download" setting.
* In Chrome, you go to the **Settings** item in the browser menu. On the "Settings" page, click on **Advanced** to view more settings. Under the advanced settings find the **Downloads** section. In that section, turn **ON** the "Ask where to save each file before downloading" setting.

## #specific

## I don't see my question here. What's next?

Can't find your question? Please see our [support](/support) page.
