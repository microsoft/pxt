import * as React from "react";
import * as data from "./data";
import * as core from "./core";
import * as sui from "./sui";
import * as auth from "./auth";
import * as ImmersiveReader from '@microsoft/immersive-reader-sdk';

import Cloud = pxt.Cloud;
import { fireClickOnEnter } from "./util";

export type ImmersiveReaderToken = {
    token: string;
    subdomain: string;
    expiration: number;
    expiresIn: number;
}

function beautifyText(content: string): string {
    // The order of these functions matter
    const cleaningFuncs = [
        replaceBoardName,
        cleanImages,
        cleanAltText,
        cleanBlockAnnotation,
        cleanInlineButtons,
        cleanMetadata,
        cleanBold,
        cleanItalics,
        cleanNewLines,
        cleanHorizontalRule,
        cleanBlockquotes,
        cleanEmojis,
        cleanUnicodeEmojis,
        convertToggles
    ];
    let contentWIP = content;
    cleaningFuncs.forEach(clean => {
        contentWIP = clean(contentWIP);
    })

    return contentWIP;

    function replaceBoardName(content: string): string {
        return content.replace(
            /@boardname@/g, pxt.appTarget.appTheme.boardName || "device"
        )
    }

    // Change ``|| around blocks to ""
    function cleanBlockAnnotation(content: string): string {
        return content.replace(
            /`?`\|\|[\w|\s]+:(.+?)\|\|``?/gu,
            (matched, word, offset, s) => lf("\"{0}\"", word)
        );
    }

    function cleanInlineButtons(content: string): string {
        return content.replace(
            /``\|([^|]+)\|``/gu,
            (matched, word, offset, s) => lf("{0}", word)
        );
    }

    // Keep the displayed word in the alt text, discard the rest
    function cleanAltText(content: string): string {
        return content.replace(
            /\w*\[([^\]]*)\]\w*\([^)]*\)/gu,
            (matched, word, offset, s) => lf("{0}", word)
        );
    }

    // Don't show any images
    function cleanImages(content: string): string {
        return content.replace(
            /(!\w*\[[^\]]*\]\w*\([^)]*\))/gu,
            ""
        );
    }

    // Remove any triple tick annotations ```
    function cleanMetadata(content: string): string {
        return content.replace(
            pxt.tutorial.getMetadataRegex(),
            ""
        );
    }

    // Remove ** and __ around bold text, replace with " if it's only one word
    function cleanBold(content: string): string {

        let singleWordBold = content.replace(
            /\*\*([^*^\s]+)\*\*|__([^\s^_]+)__/gu,
            (matched, boldStar, boldUnder, offset, s) => {
                return "\"" + lf("{0}", (boldStar ? boldStar : boldUnder)) + "\""
            }
        )

        return singleWordBold.replace(
            /\*\*([^*]+)\*\*|__([^_]+)__/gu,
            (matched, boldStar, boldUnder, offset, s) => {
                return boldStar ? lf("{0}", boldStar) : lf ("{0}", boldUnder);
            }
        );
    }

    // replace horizontal rules with new lines
    function cleanHorizontalRule(content: string): string {
        return content.replace(
            /^\* \* \*$|^- - -$|^<hr\/>$|---/gum,
            "<br />"
        );
    }

    // replace consecutive new lines with break tags so that they don't get smooshed
    function cleanNewLines(content: string): string {
        return content.replace(
            /[\r\n]{2,}/gum,
            `<br />\n`
        );
    }

    // Remove >> for blockquotes
    function cleanBlockquotes(content: string): string {
        return content.replace(
            /^>>/gu,
            ""
        )
    }

    // Replace unicode emojis with text that can be read aloud
    function cleanUnicodeEmojis(content: string): string {
        const replacedA = content.replace(
            /[Ⓐ🅐]/gu,
            lf("{0}", "A")
        );

        return replacedA.replace(
            /[Ⓑ🅑]/gu,
            lf("{0}", "B")
        );
    }

    // Remove all emojis because they get read out. Characters that aren't
    // emojis don't get hit by this RegEx, but they're silent
    function cleanEmojis(content: string): string {
        let PICTOGRAPHIC_REGEX: RegExp;
        try { // Some browsers do not support unicode property escape
            PICTOGRAPHIC_REGEX = new RegExp("\\p{Extended_Pictographic}", "ug")
        } catch {}
        const specialEmojis: string[] = [];
        if (PICTOGRAPHIC_REGEX) {
            return content.replace(
                PICTOGRAPHIC_REGEX,
                (emoji, capture, offset, s) => {
                    if (emoji == "🔲") {
                        return "•"
                    } else if (specialEmojis.indexOf(emoji) < 0) {
                        return ""
                    } else {
                        return emoji
                    }
                }
            )
        }
        return content;
    }

    // Remove * and _ italic annotations
    function cleanItalics(content: string): string {
        return content.replace(
            /\*([^*]+)\*|_([^_]+)_/gu,
            (matched, starItalics, underlineItalics, offset, s) =>
                lf("{0}", starItalics ? starItalics : underlineItalics)
        );
    }

    // Change toggles to be surrounded with ` instead of <>
    function convertToggles(content: string): string {
        return content.replace(
            /<(true|false|down|up|high|low|on|off|yes|no|win|lose)>/gui,
            (matched, word, offset, s) => {
                return "`" + lf("{0}", word) + "`";
            }
        )
    }
}

const IMMERSIVE_READER_ID = "immReaderToken";
function getTokenAsync(): Promise<ImmersiveReaderToken> {
    const storedTokenString = pxt.storage.getLocal(IMMERSIVE_READER_ID);
    const cachedToken: ImmersiveReaderToken = pxt.Util.jsonTryParse(storedTokenString);

    if (!cachedToken || (Date.now() / 1000 > cachedToken.expiration)) {
        return pxt.Cloud.privateGetAsync("immreader", true).then(
            res => {
                pxt.storage.setLocal(IMMERSIVE_READER_ID, JSON.stringify(res));
                return res;
            },
            e => {
                pxt.storage.removeLocal(IMMERSIVE_READER_ID);
                pxt.reportException(e)
                pxt.tickEvent("immersiveReader.error", {error: e.statusCode, message: e.message});
                if (e.isOffline) {
                    return Promise.reject(new Error("offline"))
                }
                return Promise.reject(new Error("token"));
            }
        );
    } else {
        pxt.tickEvent("immersiveReader.cachedToken");
        return Promise.resolve(cachedToken);
    }
}

export async function launchImmersiveReaderAsync(content: string, tutorialOptions: pxt.tutorial.TutorialOptions) {
    pxt.tickEvent("immersiveReader.launch", {tutorial: tutorialOptions.tutorial, tutorialStep: tutorialOptions.tutorialStep});

    const userReaderPref = data.getData<string>(auth.READER) || ""
    const langPref = data.getData<string>(auth.LANGUAGE) || "";
    const tutorialData = {
        chunks: [{
            content: beautifyText(content),
            mimeType: "text/html"
        }]
    }

    const options = {
        uiLang: langPref,
        onExit: () => {
            pxt.tickEvent("immersiveReader.close", {tutorial: tutorialOptions.tutorial, tutorialStep: tutorialOptions.tutorialStep})
        },
        onPreferencesChanged: (pref: string) => {
            auth.setImmersiveReaderPrefAsync(pref)
        },
        preferences: userReaderPref,
        allowFullscreen: !pxt.appTarget.simulator?.headless
    }

    try {
        let res = await getTokenAsync();
        await testConnectionAsync();
        if (!Cloud.isOnline()) {
            throw new Error("offline");
        }
        const launchStart = pxt.Util.now();
        await ImmersiveReader.launchAsync(res.token, res.subdomain, tutorialData, options)
        const elapsed = pxt.Util.now() - launchStart;
        pxt.tickEvent("immersiveReader.launch.finished", {elapsed: elapsed})
    } catch (e) {
        if (e.isOffline) {
            core.warningNotification(lf("Immersive Reader cannot be used offline"));
        } else {
            switch (e.message) {
                case "offline": {
                    core.warningNotification(lf("Immersive Reader cannot be used offline"));
                    break;
                }
                case "token":
                default: {
                    // If the token is invalid, remove it from storage
                    pxt.storage.removeLocal(IMMERSIVE_READER_ID);
                    core.warningNotification(lf("Immersive Reader could not be launched"));
                    if (typeof e == "string") {
                        pxt.tickEvent("immersiveReader.error", {message: e});
                    } else {
                        pxt.tickEvent("immersiveReader.error", {message: e.message, statusCode: e.statusCode})
                    }

                }
            }
        }
        pxt.reportException(e);
        ImmersiveReader.close();
    };

    async function testConnectionAsync() {
        // Will throw an exception here if there is an error we are not expecting
        return pxt.Cloud.privateGetAsync("ping", true);
    }
}


interface ImmersiveReaderProps {
    content: string;
    tutorialOptions: pxt.tutorial.TutorialOptions;
}

export class ImmersiveReaderButton extends data.Component<ImmersiveReaderProps, {}> {
    private buttonClickHandler = async () => {
        await launchImmersiveReaderAsync(this.props.content, this.props.tutorialOptions);
    }

    render() {
        return <div className='immersive-reader-button ui item neutral' onClick={this.buttonClickHandler}
            aria-label={lf("Launch Immersive Reader")} role="button" onKeyDown={fireClickOnEnter} tabIndex={0}
            title={lf("Launch Immersive Reader")}/>
    }
}
