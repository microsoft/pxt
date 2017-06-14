# Theming

PXT uses the [Semantic UI](http://semantic-ui.com/) framework to create the user interface.

### Blockly

To Blockly themeing, you can overwrite the default Blockly options by configuring `blocklyOptions` under your target's `appTheme`. 

See [Blockly Configuration](https://developers.google.com/blockly/guides/get-started/web) for a full list of Blockly configurable options.

## Semantic Theming

PXT comes with a default Semantic UI theme. You can however completely override the theme and use all the flexibility of Semantic UI to customize your target.

* copy the ``_theme`` folder from the project to the root of your target, and rename it to ``site``
* customize the variables!

You will most likely be updating the site variables under ``site/globals/site.variables``

From more information on themeing, visit [http://semantic-ui.com/usage/theming.html](http://semantic-ui.com/usage/theming.html)

``pxt serve`` or ``pxt buildtarget`` will automatically rebuild ``semantic.css`` and override the built-in CSS from the app.

## Favicon

Use [realfavicongenerator](http://realfavicongenerator.net/) to generate all the relevant favicon icon files and save them under ``static/icons`` in the ``docs`` folder.

## AppTheme

[pxtarget.json](/pxtarget) contains an extensive customization section (appTheme) to control logos, names, colors, etc.  Details are below (TBD):

```typescript
interface AppTheme {
        id?: string;
        name?: string;
        title?: string;
        description?: string;
        twitter?: string;
        defaultLocale?: string;
        logoUrl?: string;
        logo?: string;
        portraitLogo?: string;
        rightLogo?: string;
        docsLogo?: string;
        organization?: string;
        organizationUrl?: string;
        organizationLogo?: string;
        organizationWideLogo?: string;
        homeUrl?: string;
        shareUrl?: string;
        embedUrl?: string;
        betaUrl?: string;
        legacyDomain?: string;
        docMenu?: DocMenuEntry[];
        TOC?: TOCMenuEntry[];
        hideSideDocs?: boolean;
        sideDoc?: string; // if set: show the getting started button, clicking on getting started button links to that page
        hasReferenceDocs?: boolean; // if true: the monaco editor will add an option in the context menu to load the reference docs
        feedbackUrl?: string; // is set: a feedback link will show in the settings menu
        boardName?: string;
        driveDisplayName?: string; // name of the drive as it shows in the explorer
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        accentColor?: string;
        locales?: Map<AppTheme>;
        cardLogo?: string;
        appLogo?: string;
        htmlDocIncludes?: Map<string>;
        htmlTemplates?: Map<string>;
        githubUrl?: string;
        usbDocs?: string;
        invertedMenu?: boolean; // if true: apply the inverted class to the menu
        coloredToolbox?: boolean; // if true: color the blockly toolbox categories
        invertedToolbox?: boolean; // if true: use the blockly inverted toolbox
        invertedMonaco?: boolean; // if true: use the vs-dark monaco theme
        blocklyOptions?: Blockly.Options; // Blockly options, see Configuration: https://developers.google.com/blockly/guides/get-started/web
        disableBlockIcons?: boolean; // Disable icons in blocks
        hideBlocklyJavascriptHint?: boolean; // hide javascript preview in blockly hint menu
        simAnimationEnter?: string; // Simulator enter animation
        simAnimationExit?: string; // Simulator exit animation
        hasAudio?: boolean; // target uses the Audio manager. if true: a mute button is added to the simulator toolbar.
        galleries?: pxt.Map<string>; // list of galleries to display in projects dialog
        crowdinProject?: string;
        crowdinBranch?: string; // optional branch specification for pxt
        monacoToolbox?: boolean; // if true: show the monaco toolbox when in the monaco editor
        blockHats?: boolean; // if true, event blocks have hats
        allowParentController?: boolean; // allow parent iframe to control editor
        hideEmbedEdit?: boolean; // hide the edit button in the embedded view
        blocksOnly?: boolean; // blocks only workspace
        hideDocsSimulator?: boolean; // do not show simulator button in docs
        hideDocsEdit?: boolean; // do not show edit button in docs
        hideCookieNotice?: boolean; // always hide cookie notice for targets that embed the editor in apps/chrome
        hideMenuBar?: boolean; // Hides the main menu bar
        hideEditorToolbar?: boolean; // Hides the bottom editor toolbar
        appStoreID?: string; // Apple iTune Store ID if any
        mobileSafariDownloadProtocol?: string; // custom protocol to be used on iOS
        sounds?: {
            tutorialStep?: string;
            tutorialNext?: string;
            dialogClick?: string;
        },
        disableLiveTranslations?: boolean; // don't load translations from crowdin
        extendEditor?: boolean; // whether a target specific editor.js is loaded
        highContrast?: boolean; // simulator has a high contrast mode
        selectLanguage?: boolean; // add language picker to settings menu
        useUploadMessage?: boolean; // change "Download" text to "Upload"
        downloadIcon?: string; // which icon io use for download
        blockColors?: Map<string>; // block namespace colors, used for build in categories
    }
    ```