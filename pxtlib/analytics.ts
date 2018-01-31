/// <reference path="../localtypings/mscc" />

namespace pxt {
    // This function is defined in docfiles/pxtweb/cookieCompliance.ts
    export declare let onAnalyticsLoaded: (cb: () => void) => void;
}

namespace pxt.analytics {
    // Completely arbitrarily chosen
    const eventBufferSizeLimit = 20;

    interface TickData {
        id: string;
        data?: Map<string | number>;
        opts?: TelemetryEventOptions;
    }

    interface ExceptionData {
        err: any;
        data: pxt.Map<string>;
    }

    interface ErrorData {
        cat: string;
        msg: string;
        data?: pxt.Map<string>;
    }

    export function enable() {
        pxt.debug('setting up app insights')

        const te = pxt.tickEvent;
        const teHandled = wrap((ev: TickData) => tickEventCore(ev.id, ev.data, ev.opts));
        pxt.tickEvent = function (id: string, data?: Map<string | number>, opts?: TelemetryEventOptions): void {
            teHandled({ id, data, opts });
        };

        const rexp = pxt.reportException;
        const rexpHandled = wrap((ev: ExceptionData) => reportExceptionCore(ev.err, ev.data));
        pxt.reportException = function (err: any, data: pxt.Map<string>): void {
            rexpHandled({ err, data })
        };

        const re = pxt.reportError;
        const reHandled = wrap((ev: ErrorData) => reportErrorCore(ev.cat, ev.msg, ev.data));
        pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string>): void {
            reHandled({ cat, msg, data });
        };

        function tickEventCore(id: string, data?: Map<string | number>, opts?: TelemetryEventOptions) {
            let ai = (window as any).appInsights;
            if (!ai) return;
            if (te) te(id, data, opts);

            if (opts && opts.interactiveConsent && typeof mscc !== "undefined" && !mscc.hasConsent()) {
                mscc.setConsent();
            }
            if (!data) ai.trackEvent(id);
            else {
                const props: Map<string> = {};
                const measures: Map<number> = {};
                for (const k in data)
                    if (typeof data[k] == "string") props[k] = <string>data[k];
                    else measures[k] = <number>data[k];
                ai.trackEvent(id, props, measures);
            }
        }

        function reportExceptionCore(err: any, data: pxt.Map<string>) {
            let ai = (window as any).appInsights;
            if (!ai) return;
            if (rexp) rexp(err, data);
            const props: pxt.Map<string> = {
                target: pxt.appTarget.id,
                version: pxt.appTarget.versions.target
            }
            if (data) Util.jsonMergeFrom(props, data);
            ai.trackException(err, 'exception', props)
        }

        function reportErrorCore(cat: string, msg: string, data?: pxt.Map<string>) {
            let ai = (window as any).appInsights;
            if (!ai) return;
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
                ai.trackException(err, 'error', props)
            }
        }
    }

    function wrap<T>(cb: (ev: T) => void): (ev: T) => void {
        let q: T[] = [];
        let loaded = !(pxt.onAnalyticsLoaded);

        if (!loaded) {
            pxt.onAnalyticsLoaded(() => {
                loaded = true;
                while (q.length) {
                    cb(q.shift())
                }
            });
        }

        return (ev: T) => {
            if (loaded) {
                cb(ev)
            }
            else {
                q.push(ev);
                if (q.length >= eventBufferSizeLimit) q.shift();
            }
        }
    }
}