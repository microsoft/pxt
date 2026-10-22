/// <reference path="simframedom.ts"/>

namespace pxsim {
    export interface SimulatorDriverOptions extends SimulatorCoordinatorOptions {
        revealElement?: (el: HTMLElement) => void;
        removeElement?: (el: HTMLElement, onComplete?: () => void) => void;
        /**
         * Hides the wrapper of a permanent simulator frame when the simulator is
         * hidden, leaving the element in the container, then calls `onComplete`.
         * `unhideElement` must reveal it. When unset, `hide()` passes permanent
         * frames to `removeElement` like any other frame.
         */
        hideElement?: (el: HTMLElement, onComplete?: () => void) => void;
        unhideElement?: (el: HTMLElement) => void;
    }

    class DomSimEnvironment implements SimEnvironment {
        get origin() { return window.location.origin; }

        href() { return window.location.href; }

        parentTarget(): SimMessageTarget | undefined {
            return window.parent && window.parent !== window.window
                ? window.parent : window.opener;
        }

        isTargetAlive(target: SimMessageTarget) {
            return !!(target as Window).parent;
        }

        configuredSimUrl(): string | undefined {
            return (window as any).pxtConfig?.simUrl || (pxt as any).webConfig?.simUrl;
        }

        addMessageListener(listener: (origin: string, data: any, source: unknown) => void) {
            const handler = (ev: MessageEvent) => listener(ev.origin, ev.data, ev.source);
            window.addEventListener('message', handler, false);
            return () => window.removeEventListener('message', handler, false);
        }
    }

    /** The browser simulator driver: a coordinator whose frames are iframes inside `container`. */
    export class SimulatorDriver extends SimulatorCoordinator {
        constructor(public container: HTMLElement,
            public options: SimulatorDriverOptions = {}) {
            super(new DomSimFrameHost(container, options), new DomSimEnvironment(), options);
        }

        public isLoanedSimulator(el: HTMLElement) {
            return (this.frameHost as DomSimFrameHost).isLoanedFrame(el);
        }

        // returns a simulator iframe that can be hosted anywhere in the page
        // while a loaned simulator is active, all other iframes are suspended
        public loanSimulator(): HTMLDivElement {
            return (this.frameHost as DomSimFrameHost).loanSimulator(() => this.createFrame("detached"));
        }

        public unloanSimulator() {
            (this.frameHost as DomSimFrameHost).unloanSimulator();
        }
    }
}
