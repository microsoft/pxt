# Theming

PXT uses the [Semantic UI](http://semantic-ui.com/) framework to create the user interface.

### Blockly

For Blockly theming, you can overwrite the default Blockly options by configuring `blocklyOptions` under your target's `appTheme`.

See [Blockly Configuration](https://developers.google.com/blockly/guides/get-started/web) for a full list of Blockly configurable options.

## Semantic Theming

PXT comes with a default Semantic UI theme. You can however completely override the theme and use all the flexibility of Semantic UI to customize your target.

* copy the ``_theme`` folder from the project to the root of your target, and rename it to ``site``
* customize the variables!

You will most likely be updating the site variables under ``site/globals/site.variables``

From more information on theming, visit [http://semantic-ui.com/usage/theming.html](http://semantic-ui.com/usage/theming.html)

``pxt serve`` or ``pxt buildtarget`` will automatically rebuild ``semantic.css`` and override the built-in CSS from the app.

## Favicon

Use [realfavicongenerator](http://realfavicongenerator.net/) to generate all the relevant favicon icon files and save them under ``static/icons`` in the ``docs`` folder.

## The cookie consent banner

PXT injects a banner into each page to notify users that this website uses cookies. This banner is present on all pages including the editor, the docs, and makecode.com. If required, you can remove the banner by overriding `docfiles/tracking.html` in a target and removing the call to `pxt.initAnalytics()` (doing so will also disable Applicaiton Insights). Previously this was configured in [pxtarget.json](/targets/pxtarget).

## AppTheme

[pxtarget.json](/targets/pxtarget) contains an extensive customization section (appTheme) to control logos, names, colors, etc.  Details are below (TBD):

```typescript
interface AppTheme {
        // naming
        id?: string;
        name?: string;
        title?: string;
        description?: string;
        boardName?: string;

        // associated social/store information
        appStoreID?: string; // Apple iTune Store ID if any
        twitter?: string;

        // localization
        defaultLocale?: string;
        locales?: Map<AppTheme>;
        crowdinProject?: string;
        crowdinBranch?: string; // optional branch specification for pxt
        selectLanguage?: boolean; // add language picker to settings menu
        disableLiveTranslations?: boolean; // don't load translations from crowdin

        // logos
        logoUrl?: string;
        logo?: string;
        portraitLogo?: string;
        rightLogo?: string;
        docsLogo?: string;
        cardLogo?: string;
        appLogo?: string;

        // branding
        organization?: string;
        organizationUrl?: string;
        organizationLogo?: string;
        organizationWideLogo?: string;

        // associated URLs
        homeUrl?: string;
        shareUrl?: string;
        embedUrl?: string;
        privacyUrl?: string;
        termsOfUseUrl?: string;
        contactUrl?: string;
        feedbackUrl?: string; // is set: a feedback link will show in the settings menu
        githubUrl?: string;

        // menu authoring and theming
        docMenu?: DocMenuEntry[];   // help menu
        TOC?: TOCMenuEntry[];       // see SUMMARY.md also
        galleries?: pxt.Map<string>; // list of galleries to display in projects dialog
        hideMenuBar?: boolean; // Hides the main menu bar
        hideEditorToolbar?: boolean; // Hides the bottom editor toolbar

        // getting started and documentation
        sideDoc?: string; // if set: show the getting started button, clicking on getting started button links to that page
        hideSideDocs?: boolean;
        hideDocsSimulator?: boolean; // do not show simulator button in docs
        hideDocsEdit?: boolean; // do not show edit button in docs
        usbDocs?: string;
        htmlDocIncludes?: Map<string>;
        htmlTemplates?: Map<string>;

        // editor theming
        accentColor?: string;
        blocksOnly?: boolean; // blocks only workspace
        invertedMenu?: boolean; // if true: apply the inverted class to the menu

        // blockly theming
        blockColors?: Map<string>; // block namespace colors, used for build in categories
        coloredToolbox?: boolean; // if true: color the blockly toolbox categories
        invertedToolbox?: boolean; // if true: use the blockly inverted toolbox
        blocklyOptions?: Blockly.Options; // Blockly options, see Configuration: https://developers.google.com/blockly/guides/get-started/web
        blockHats?: boolean; // if true, event blocks have hats

        // monaco theming
        invertedMonaco?: boolean; // if true: use the vs-dark monaco theme
        monacoToolbox?: boolean; // if true: show the monaco toolbox when in the monaco editor
        hasReferenceDocs?: boolean; // if true: the monaco editor will add an option in the context menu to load the reference docs

        // simulator theming
        simAnimationEnter?: string; // Simulator enter animation
        simAnimationExit?: string; // Simulator exit animation
        hasAudio?: boolean; // target uses the Audio manager. if true: a mute button is added to the simulator toolbar.
        highContrast?: boolean; // simulator has a high contrast mode

        // running in an iframe
        allowParentController?: boolean; // allow parent iframe to control editor
        extendEditor?: boolean; // whether a target specific editor.js is loaded

        // options around downloading a compiled file
        useUploadMessage?: boolean; // change "Download" text to "Upload"
        downloadIcon?: string; // which icon io use for download
        driveDisplayName?: string; // name of the drive as it shows in the explorer

        // miscellaneous
        hideEmbedEdit?: boolean; // hide the edit button in the embedded view
        mobileSafariDownloadProtocol?: string; // custom protocol to be used on iOS
        sounds?: {
            tutorialStep?: string;
            tutorialNext?: string;
            dialogClick?: string;
        },
    }
    ```