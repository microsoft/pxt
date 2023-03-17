namespace pxt {
    // These functions are defined in docfiles/pxtweb/cookieCompliance.ts
    export declare function aiTrackEvent(id: string, data?: any, measures?: any): void;
    export declare function aiTrackException(err: any, kind: string, props: any): void;
    export declare function setInteractiveConsent(enabled: boolean): void;
}

namespace pxt.analytics {
    const defaultProps: Map<string> = {};
    const defaultMeasures: Map<number> = {};
    let enabled = false;

    export function addDefaultProperties(props: Map<string | number>) {
        Object.keys(props).forEach(k => {
            if (typeof props[k] == "string") {
                defaultProps[k] = <string>props[k];
            } else {
                defaultMeasures[k] = <number>props[k];
            }
        });
    }

    export function enable(lang: string) {
        if (!pxt.aiTrackException || !pxt.aiTrackEvent || enabled) return;

        enabled = true;
        if (typeof lang != "string" || lang.length == 0) {
            lang = "en"; //Always have a default language.
        }
        addDefaultProperties({ lang: lang })

        pxt.debug('setting up app insights')

        const te = pxt.tickEvent;
        pxt.tickEvent = function (id: string, data?: Map<string | number>, opts?: TelemetryEventOptions): void {
            // Log tick to console if "consoleticks" url param is present.
            // We do this simple check first (rather than the full parse) to minimize overhead when it's not present, which is most of the time.
            if(window && /consoleticks=/.test(window.location.href))
            {
                consoleLogTick(id, data, opts);
            }

            if (te) te(id, data, opts);

            if (opts?.interactiveConsent) pxt.setInteractiveConsent(true);

            if (!data) pxt.aiTrackEvent(id);
            else {
                const props: Map<string> = { ...defaultProps } || {};
                const measures: Map<number> = { ...defaultMeasures } || {};
                Object.keys(data).forEach(k => {
                    if (typeof data[k] == "string") props[k] = <string>data[k];
                    else if (typeof data[k] == "number") measures[k] = <number>data[k];
                    else props[k] = JSON.stringify(data[k] || '');
                });
                pxt.aiTrackEvent(id, props, measures);
            }
        };

        const rexp = pxt.reportException;
        pxt.reportException = function (err: any, data: pxt.Map<string | number>): void {
            if (rexp) rexp(err, data);
            const props: pxt.Map<string> = {
                target: pxt.appTarget.id,
                version: pxt.appTarget.versions.target
            }
            if (data) Util.jsonMergeFrom(props, data);
            pxt.aiTrackException(err, 'exception', props)
        };

        const re = pxt.reportError;
        pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string | number>): void {
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

    function consoleLogTick(id: string, data: Map<string | number>, opts: TelemetryEventOptions) {
        const query = Util.parseQueryString(window.location.href);

        // Optionally specify consoletickfilter to limit which ticks get printed.
        if (!query["consoletickfilter"] || id.startsWith(query["consoletickfilter"])) {
            const tickInfo = `${id} ${data ? JSON.stringify(data) : "<no data>"} ${opts ? JSON.stringify(opts) : "<no opts>"}`;

            if (query["consoleticks"] == "1" || query["consoleticks"] == "full") {
                const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false });
                console.log(`${timestamp} - Tick - ${tickInfo}`);
            } else if (query["consoleticks"] == "2" || query["consoleticks"] == "short") {
                console.log(tickInfo);
            }
        }
    }
}
