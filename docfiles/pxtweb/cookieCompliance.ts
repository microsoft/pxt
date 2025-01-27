declare let process: any;

namespace pxt {
    type Map<T> = { [index: string]: T };

    const eventBufferSizeLimit = 20;
    const queues: TelemetryQueue<any, any, any>[] = [];

    let analyticsLoaded = false;
    let interactiveConsent = false;
    let isProduction = false;
    let partnerName: string;

    class TelemetryQueue<A, B, C> {
        private q: [A, B, C][] = [];
        constructor(private log: (a?: A, b?: B, c?: C) => void) {
            queues.push(this);
        }

        public track(a: A, b: B, c: C) {
            if (analyticsLoaded) {
                this.log(a, b, c);
            }
            else {
                this.q.push([a, b, c]);
                if (this.q.length > eventBufferSizeLimit) this.q.shift();
            }
        }

        public flush() {
            while (this.q.length) {
                const [a, b, c] = this.q.shift();
                this.log(a, b, c);
            }
        }
    }

    let eventLogger: TelemetryQueue<string, Map<string>, Map<number>>;
    let exceptionLogger: TelemetryQueue<any, string, Map<string>>;

    type EventListener<T = any> = (payload: T) => void;
    type EventSource<T> = {
        subscribe(listener: (payload: T) => void): () => void;
        emit(payload: T): void;
    };

    function createEventSource<T = any>(): EventSource<T> {
        const listeners: EventListener<T>[] = [];

        return {
            subscribe(listener: EventListener<T>): () => void {
                listeners.push(listener);
                // Return an unsubscribe function
                return () => {
                    const index = listeners.indexOf(listener);
                    if (index !== -1) {
                        listeners.splice(index, 1);
                    }
                };
            },
            emit(payload: T): void {
                listeners.forEach(listener => listener(payload));
            }
        };
    }

    // performance measuring, added here because this is amongst the first (typescript) code ever executed
    export namespace perf {
        let enabled: boolean;

        export const onMilestone = createEventSource<{ milestone: string, time: number, params?: Map<string> }>();
        export const onMeasurement = createEventSource<{ name: string, start: number, duration: number, params?: Map<string> }>();

        export let startTimeMs: number;
        export let stats: {
            // name, start, duration, params
            durations: [string, number, number, Map<string>?][],
            // name, event
            milestones: [string, number, Map<string>?][]
        } = {
            durations: [],
            milestones: []
        }
        export function isEnabled() { return enabled; }
        export let perfReportLogged = false
        export function splitMs(): number {
            return Math.round(performance.now() - startTimeMs)
        }
        export function prettyStr(ms: number): string {
            ms = Math.round(ms)
            let r_ms = ms % 1000
            let s = Math.floor(ms / 1000)
            let r_s = s % 60
            let m = Math.floor(s / 60)
            if (m > 0)
                return `${m}m${r_s}s`
            else if (s > 5)
                return `${s}s`
            else if (s > 0)
                return `${s}s${r_ms}ms`
            else
                return `${ms}ms`
        }
        export function splitStr(): string {
            return prettyStr(splitMs())
        }

        export function recordMilestone(msg: string, params?: Map<string>) {
            const time = splitMs()
            stats.milestones.push([msg, time, params])
            onMilestone.emit({ milestone: msg, time, params });
        }
        export function init() {
            enabled = performance && !!performance.mark && !!performance.measure;
            if (enabled) {
                performance.measure("measure from the start of navigation to now")
                let navStartMeasure = performance.getEntriesByType("measure")[0]
                startTimeMs = navStartMeasure.startTime
            }
        }
        export function measureStart(name: string) {
            if (enabled) performance.mark(`${name} start`)
        }
        export function measureEnd(name: string, params?: Map<string>) {
            if (enabled && performance.getEntriesByName(`${name} start`).length) {
                performance.mark(`${name} end`)
                performance.measure(`${name} elapsed`, `${name} start`, `${name} end`)
                let e = performance.getEntriesByName(`${name} elapsed`, "measure")
                if (e && e.length === 1) {
                    let measure = e[0]
                    let durMs = measure.duration
                    if (durMs > 10) {
                        stats.durations.push([name, measure.startTime, durMs, params])
                        onMeasurement.emit({ name, start: measure.startTime, duration: durMs, params });
                    }
                }
                performance.clearMarks(`${name} start`)
                performance.clearMarks(`${name} end`)
                performance.clearMeasures(`${name} elapsed`)
            }
        }
        export function report(filter: string = null) {
            perfReportLogged = true;
            if (enabled) {
                const milestones: { [index: string]: number } = {};
                const durations: { [index: string]: number } = {};

                let report = `Performance Report:\n`
                report += `\n`
                report += `\tMilestones:\n`
                for (let [msg, time, params] of stats.milestones) {
                    if (!filter || msg.indexOf(filter) >= 0) {
                        let pretty = prettyStr(time)
                        report += `\t\t${msg} @ ${pretty}`
                        for (let k of Object.keys(params || {})) {
                            report += `\n\t\t\t${k}: ${params[k]}`
                        }
                        report += `\n`
                        milestones[msg] = time;
                    }
                }

                report += `\n`
                report += `\tMeasurements:\n`
                for (let [msg, start, duration, params] of stats.durations) {
                    let filterIncl = filter && msg.indexOf(filter) >= 0
                    if ((duration > 50 && !filter) || filterIncl) {
                        let pretty = prettyStr(duration)
                        report += `\t\t${msg} took ~ ${pretty}`
                        if (duration > 1000) {
                            report += ` (${prettyStr(start)} - ${prettyStr(start + duration)})`
                            for (let k of Object.keys(params || {})) {
                                report += `\n\t\t\t${k}: ${params[k]}`
                            }
                        }
                        report += `\n`
                    }
                    durations[msg] = duration;
                }
                console.log(report)
                enabled = false; // stop collecting milestones and measurements after report
                return { milestones, durations };
            }
            return undefined;
        }
        (function () {
            init()
            recordMilestone("first JS running")
        })()
    }

    export function initAnalyticsAsync() {
        if (isNativeApp() || shouldHideCookieBanner()) {
            initializeAppInsightsInternal(true);
            return;
        }

        if ((window as any).pxtSkipAnalyticsCookie) {
            initializeAppInsightsInternal(false);
            return;
        }

        initializeAppInsightsInternal(true);
    }

    export function aiTrackEvent(id: string, data?: any, measures?: any) {
        if (!eventLogger) {
            eventLogger = new TelemetryQueue((a, b, c) =>
                (window as any).appInsights.trackEvent({
                    name: a,
                    properties: b,
                    measurements: c,
                })
            );
        }
        eventLogger.track(id, data, measures);
    }

    export function aiTrackException(err: any, kind?: string, props?: any) {
        if (!exceptionLogger) {
            exceptionLogger = new TelemetryQueue((a, b, c) =>
                (window as any).appInsights.trackException({
                    exception: a,
                    properties: b ? { ...c, ["kind"]: b } : c,
                })
            );
        }
        exceptionLogger.track(err, kind, props);
    }

    export function initializeAppInsightsInternal(includeCookie = false) {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.has("partner")) {
                partnerName = params.get("partner");
            }
        }
        catch (e) {
            console.warn("Could not parse search string", e);
        }

        // loadAppInsights is defined in docfiles/tracking.html
        const loadAI = (window as any).loadAppInsights;
        if (loadAI) {
            isProduction = loadAI(includeCookie, telemetryInitializer);
            analyticsLoaded = true;
            queues.forEach(a => a.flush());
        }
    }

    function telemetryInitializer(envelope: any) {
        const pxtConfig = (window as any).pxtConfig;

        // App Insights automatically sends a page view event on setup, but we send our own later with additional properties.
        // This stops the automatic event from firing, so we don't end up with duplicate page view events.
        if (envelope.baseType == "PageviewData" && !envelope.baseData.properties) {
            return false;
        }

        if (envelope.baseType == "PageviewPerformanceData") {
            const pageName = envelope.baseData.name;
            envelope.baseData.name = window.location.origin;
            if (!envelope.baseData.properties) {
                envelope.baseData.properties = {};
            }
            envelope.baseData.properties.pageName = pageName;
            envelope.baseData.properties.pathName = window.location.pathname;
            // no url scrubbing for webapp (no share url, etc)
        }

        if (typeof pxtConfig === "undefined" || !pxtConfig) return true;

        const telemetryItem = envelope.baseData;
        telemetryItem.properties = telemetryItem.properties || {};
        telemetryItem.properties["target"] = pxtConfig.targetId;
        telemetryItem.properties["stage"] = (pxtConfig.relprefix || "/--").replace(/[^a-z]/ig, '')

        if (partnerName) {
            telemetryItem.properties["partner"] = partnerName;
        }

        const userAgent = navigator.userAgent.toLowerCase();
        const electronRegexResult = /\belectron\/(\d+\.\d+\.\d+.*?)(?: |$)/i.exec(userAgent); // Example navigator.userAgent: "Mozilla/5.0 Chrome/61.0.3163.100 Electron/2.0.0 Safari/537.36"
        if (electronRegexResult) {
            telemetryItem.properties["Electron"] = 1;
            telemetryItem.properties["ElectronVersion"] = electronRegexResult[1];
        }

        const pxtElectron = (window as any).pxtElectron;
        if (typeof pxtElectron !== "undefined") {
            telemetryItem.properties["PxtElectron"] = 1;
            telemetryItem.properties["ElectronVersion"] = pxtElectron.versions.electronVersion;
            telemetryItem.properties["ChromiumVersion"] = pxtElectron.versions.chromiumVersion;
            telemetryItem.properties["NodeVersion"] = pxtElectron.versions.nodeVersion;
            telemetryItem.properties["PxtElectronVersion"] = pxtElectron.versions.pxtElectronVersion;
            telemetryItem.properties["PxtCoreVersion"] = pxtElectron.versions.pxtCoreVersion;
            telemetryItem.properties["PxtTargetVersion"] = pxtElectron.versions.pxtTargetVersion;
            telemetryItem.properties["PxtElectronIsProd"] = pxtElectron.versions.isProd;
        }

        // Kiosk UWP info is appended to the user agent by the makecode-dotnet-apps/arcade-kiosk UWP app
        const kioskUwpRegexResult = /\((MakeCode Arcade Kiosk UWP)\/([\S]+)\/([\S]+)\)/i.exec(userAgent); // Example navigator.userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.60 (MakeCode Arcade Kiosk UWP/0.1.41.0/Windows.Xbox)"
        if (kioskUwpRegexResult) {
            telemetryItem.properties["KioskUwp"] = 1;
            telemetryItem.properties["KioskUwpVersion"] = kioskUwpRegexResult[2];
            telemetryItem.properties["KioskUwpPlatform"] = kioskUwpRegexResult[3];
        }

        // "cookie" does not actually correspond to whether or not we drop the cookie because we recently
        // switched to immediately dropping it rather than waiting. Instead, we maintain the legacy behavior
        // of only setting it to true for production sites where interactive consent has been obtained
        // so that we don't break legacy queries
        telemetryItem.properties["cookie"] = interactiveConsent && isProduction;

        return true;
    }

    export function setInteractiveConsent(enabled: boolean) {
        interactiveConsent = enabled;
    }

    /**
     * Checks for pxt-electron and Code Connection
     */
    function isNativeApp(): boolean {
        const hasWindow = typeof window !== "undefined";
        const isPxtElectron = hasWindow && !!(window as any).pxtElectron;
        const isCC = hasWindow && !!(window as any).ipcRenderer || /ipc=1/.test(location.hash) || /ipc=1/.test(location.search); // In WKWebview, ipcRenderer is injected later, so use the URL query
        return isPxtElectron || isCC;
    }
    /**
     * Checks whether we should hide the cookie banner
     */
    function shouldHideCookieBanner(): boolean {
        //We don't want a cookie notification when embedded in editor controllers, we'll use the url to determine that
        const noCookieBanner = isIFrame() && /nocookiebanner=1/i.test(window.location.href)
        return noCookieBanner;
    }
    function isIFrame(): boolean {
        try {
            return window && window.self !== window.top;
        } catch (e) {
            return false;
        }
    }
    /**
     * checks for sandbox
     */
    function isSandboxMode(): boolean {
        //This is restricted set from pxt.shell.isSandBoxMode and specific to share page
        //We don't want cookie notification in the share page
        const sandbox = /sandbox=1|#sandbox|#sandboxproject/i.test(window.location.href)
        return sandbox;
    }
}
