/// <reference path="../localtypings/mscc" />

namespace pxt {
    // These functions are defined in docfiles/pxtweb/cookieCompliance.ts
    export declare function aiTrackEvent(id: string, data?: any, measures?: any): void;
    export declare function aiTrackException(err: any, kind: string, props: any): void;
}

namespace pxt.analytics {
    export function enable() {
        if (!pxt.aiTrackException || !pxt.aiTrackEvent) return;

        pxt.debug('setting up app insights')

        const te = pxt.tickEvent;
        pxt.tickEvent = function (id: string, data?: Map<string | number>, opts?: TelemetryEventOptions): void {
            if (te) te(id, data, opts);

            if (opts && opts.interactiveConsent && typeof mscc !== "undefined" && !mscc.hasConsent()) {
                mscc.setConsent();
            }
            if (!data) pxt.aiTrackEvent(id);
            else {
                const props: Map<string> = {};
                const measures: Map<number> = {};
                for (const k in data)
                    if (typeof data[k] == "string") props[k] = <string>data[k];
                    else measures[k] = <number>data[k];
                    pxt.aiTrackEvent(id, props, measures);
            }
        };

        const rexp = pxt.reportException;
        pxt.reportException = function (err: any, data: pxt.Map<string>): void {
            if (rexp) rexp(err, data);
            const props: pxt.Map<string> = {
                target: pxt.appTarget.id,
                version: pxt.appTarget.versions.target
            }
            if (data) Util.jsonMergeFrom(props, data);
            pxt.aiTrackException(err, 'exception', props)
        };

        const re = pxt.reportError;
        pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string>): void {
            if (re) re(cat, msg, data);
            try {
                throw msg
            }
            catch (err) {
                const props: pxt.Map<string> = {
                    target: pxt.appTarget.id,
                    version: pxt.appTarget.versions.target,
                    category: cat,
                    message: msg
                }
                if (data) Util.jsonMergeFrom(props, data);
                pxt.aiTrackException(err, 'error', props);
            }
        };
    }

    export function isCookieBannerVisible() {
        return typeof mscc !== "undefined" && !mscc.hasConsent();
    }

    export function enableCookies() {
        if (isCookieBannerVisible()) {
            mscc.setConsent();
        }
    }
}