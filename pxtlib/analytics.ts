namespace pxt.analytics {
    export function enable() {
        let ai = (window as any).appInsights;
        if (!ai) return;

        pxt.debug('enabling app insights')

        const te = pxt.tickEvent;
        pxt.tickEvent = function (id: string, data?: Map<string | number>): void {
            if (te) te(id, data);
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

        const rexp = pxt.reportException;
        pxt.reportException = function (err: any, data: any): void {
            if (rexp) rexp(err, data);
            const props: pxt.Map<string> = {
                target: pxt.appTarget.id,
                version: pxt.appTarget.versions.target
            }
            if (data)
                for (let k in data)
                    props[k] = typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]);
            ai.trackException(err, 'exception', props)
        }
        const re = pxt.reportError;
        pxt.reportError = function (msg: string, data: any): void {
            if (re) re(msg, data);
            try {
                throw msg
            }
            catch (err) {
                let props: pxt.Map<string> = {
                    target: pxt.appTarget.id,
                    version: pxt.appTarget.versions.target
                }
                if (data)
                    for (let k in data)
                        props[k] = typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]);
                ai.trackException(err, 'error', props)
            }
        }
    }
}