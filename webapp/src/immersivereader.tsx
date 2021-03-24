import * as React from "react";
import * as data from "./data";
import * as auth from "./auth";
import * as core from "./core";
import * as sui from "./sui";
import * as ImmersiveReader from '@microsoft/immersive-reader-sdk';

import Cloud = pxt.Cloud;

export type ImmersiveReaderToken = {
    token: string;
    subdomain: string;
    expiration: number;
    expiresIn: number;
}

function beautifyText(content: string): string {
    const cleaningFuncs = [
        cleanImages,
        cleanBlockAnnotation,
        cleanBold,
        cleanHorizontalRule,
        cleanNewLines,
    ];
    let contentWIP = content;

    cleaningFuncs.forEach(clean => {
        contentWIP = clean(contentWIP);
    })

    return contentWIP;

    // Change ``|| around blocks to ""
    function cleanBlockAnnotation(content: string): string {
        return content.replace(
            /`?`\|\|[\w|\s]+:(.+?)\|\|``?/gu,
            (matched, word, offset, s) => lf("\"{0}\"", word)
        );
    }

    // Don't show any images
    function cleanImages(content: string): string {
        return content.replace(
            /(!\w*\[[^\]]*\]\w*\([^)]*\))/gu,
            ""
        );
    }

    // Remove ** around bold text, replace with "
    function cleanBold(content: string): string {
        return content.replace(
            /\*\*([^*]+)\*\*/gu,
            (matched, word, offset, s) => lf("\"{0}\"", word)
        );
    }

    // replace horizontal rules with new lines
    function cleanHorizontalRule(content: string): string {
        return content.replace(
            /^\* \* \*$/gum,
            "- - -"
        );
    }

    // replace consecutive new lines with break tags so that they don't get smooshed
    function cleanNewLines(content: string): string {
        return content.replace(
            /[\r\n]{2,}/gum,
            `<br />`
        );
    }
}

function getTokenAsync(): Promise<ImmersiveReaderToken> {
    if (Cloud.isOnline()) {
        const storedTokenString = pxt.storage.getLocal('immReader');
        const cachedToken: ImmersiveReaderToken = pxt.Util.jsonTryParse(storedTokenString);

        if (!cachedToken || (Date.now() / 1000 > cachedToken.expiration)) {
            return auth.apiAsync("/api/immreader").then(res => {
                if (res.statusCode == 200 ) {
                    pxt.storage.setLocal('immReader', JSON.stringify(res.resp));
                    return res.resp;
                } else {
                    pxt.storage.removeLocal("/api/immreader");
                    console.log("immersive reader fetch token error: " + JSON.stringify(res.err));
                    pxt.tickEvent("immersiveReader.error", {error: JSON.stringify(res.err)})
                    return Promise.reject(new Error("token"));
                }
            });
        } else {
            pxt.tickEvent("immersiveReader.cachedToken");
            return Promise.resolve(cachedToken);
        }
    } else {
        return Promise.reject(new Error("offline"));
    }
}

export function launchImmersiveReader(content: string, tutorialOptions: pxt.tutorial.TutorialOptions) {
    pxt.tickEvent("immersiveReader.launch", {tutorial: tutorialOptions.tutorial, tutorialStep: tutorialOptions.tutorialStep});

    const data = {
        chunks: [{
            content: beautifyText(content),
            mimeType: "text/html"
        }]
    }

    const options = {
        onExit: () => {pxt.tickEvent("immersiveReader.close")}
    }

    getTokenAsync().then(res => ImmersiveReader.launchAsync(res.token, res.subdomain, data, options)).catch(e => {
        switch (e.message) {
            case "offline": {
                core.warningNotification(lf("Immersive Reader cannot be used offline"));
                break;
            }
            default: {
                core.warningNotification(lf("Immersive Reader could not be launched"));
            }
        }
        console.log("Immersive Reader Error: " + e);
        ImmersiveReader.close();
    });
}


interface ImmersiveReaderProps {
    content: string;
    tutorialOptions: pxt.tutorial.TutorialOptions;
}

export class ImmersiveReaderButton extends data.Component<ImmersiveReaderProps, {}> {
    private buttonClickHandler = () => {
        launchImmersiveReader(this.props.content, this.props.tutorialOptions);
    }

    render() {
        return <div className='immersive-reader-button ui item' onClick={this.buttonClickHandler}
            aria-label={lf("Launch Immersive Reader")} role="button" onKeyDown={sui.fireClickOnEnter} tabIndex={0}
            title={lf("Launch Immersive Reader")}/>
    }
}