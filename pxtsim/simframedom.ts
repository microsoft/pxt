// Browser implementation of SimFrameHost: frames are iframes inside wrapper divs in a container element.
namespace pxsim {
    const FRAME_DATA_MESSAGE_CHANNEL = "messagechannel";
    const FRAME_ASPECT_RATIO = "aspectratio";
    const PERMANENT = "permanent";

    /** A simulator frame backed by an iframe. Its state lives in the iframe's dataset. */
    class DomSimFrame implements SimFrame {
        constructor(public readonly element: HTMLIFrameElement) { }

        get id() { return this.element.id; }

        get messageChannel() { return this.element.dataset[FRAME_DATA_MESSAGE_CHANNEL]; }
        set messageChannel(value: string) { this.element.dataset[FRAME_DATA_MESSAGE_CHANNEL] = value; }

        get runId() { return this.element.dataset["runid"]; }
        set runId(value: string) { this.element.dataset["runid"] = value; }

        get runtimeId() { return this.element.dataset["runtimeid"]; }
        set runtimeId(value: string) { this.element.dataset["runtimeid"] = value; }

        get permanent() { return !!this.element.dataset[PERMANENT]; }
        set permanent(value: boolean) {
            if (value) this.element.dataset[PERMANENT] = "true";
            else delete this.element.dataset[PERMANENT];
        }

        get loading() { return !!this.element.dataset["loading"]; }
        set loading(value: boolean) {
            if (value) this.element.dataset["loading"] = "true";
            else delete this.element.dataset["loading"];
        }

        get origin() { return this.element.dataset["origin"]; }
        set origin(value: string) { this.element.dataset["origin"] = value; }

        get aspectRatio() {
            const ratio = parseFloat(this.element.dataset[FRAME_ASPECT_RATIO]);
            return isNaN(ratio) ? undefined : ratio;
        }
        set aspectRatio(value: number) { this.element.dataset[FRAME_ASPECT_RATIO] = value + ""; }

        get attached() { return !!this.element.contentWindow; }

        get wrapper() { return this.element.parentElement as HTMLDivElement; }

        matchesSource(source: unknown) { return this.element.contentWindow == source; }

        focus() { this.element.focus(); }
    }

    export class DomSimFrameHost implements SimFrameHost {
        private loanedSimulator: HTMLDivElement;
        private wrappers = new WeakMap<HTMLIFrameElement, DomSimFrame>();

        constructor(public container: HTMLElement, private options: SimulatorDriverOptions) { }

        private wrap(element: HTMLIFrameElement): DomSimFrame {
            let frame = this.wrappers.get(element);
            if (!frame) {
                frame = new DomSimFrame(element);
                this.wrappers.set(element, frame);
            }
            return frame;
        }

        frames(skipLoaned = false): SimFrame[] {
            const frames = pxsim.util.toArray(this.container.getElementsByTagName("iframe")).map(el => this.wrap(el));
            const loanedFrame = this.loanedIFrame();
            if (loanedFrame && !skipLoaned)
                frames.unshift(this.wrap(loanedFrame));
            return frames;
        }

        frameById(id: string): SimFrame | undefined {
            const element = document.getElementById(id) as HTMLIFrameElement;
            return element ? this.wrap(element) : undefined;
        }

        createFrame(spec: SimFrameSpec, position: SimFramePosition): SimFrame {
            const wrapper = document.createElement("div") as HTMLDivElement;
            wrapper.className = `simframe ui embed`;
            wrapper.setAttribute('tabindex', '0');
            spec.wrapperClasses?.forEach(cls => pxsim.U.addClass(wrapper, cls));

            const frame = document.createElement('iframe') as HTMLIFrameElement;
            frame.id = spec.id;
            frame.title = pxsim.localization.lf("Simulator")
            frame.allowFullscreen = true;
            frame.setAttribute('allow', 'autoplay;microphone');
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            frame.className = 'no-select';

            frame.src = spec.url;
            frame.frameBorder = "0";
            frame.dataset['runid'] = spec.runId;
            frame.dataset['origin'] = spec.origin;
            frame.dataset['loading'] = "true";
            if (spec.autofocus) frame.setAttribute("autofocus", "true");

            wrapper.appendChild(frame);

            const i = document.createElement("i");
            i.className = "videoplay xicon icon";
            i.style.display = "none";
            i.onclick = (ev) => {
                ev.preventDefault();
                spec.onPlayClick();
                frame.focus()
                return false;
            }
            wrapper.appendChild(i);

            const l = document.createElement("div");
            l.className = "ui active loader";
            i.style.display = "none";
            wrapper.appendChild(l);

            if (position === "first")
                this.container.insertBefore(wrapper, this.container.firstElementChild);
            else if (position === "last")
                this.container.appendChild(wrapper);

            return this.wrap(frame);
        }

        get canRemoveFrames() { return !!this.options.removeElement; }
        get canHideFrames() { return !!this.options.hideElement; }
        get canUnhideFrames() { return !!this.options.unhideElement; }

        removeFrame(frame: SimFrame, onComplete?: () => void) {
            const wrapper = (frame as DomSimFrame).wrapper;
            if (this.options.removeElement) this.options.removeElement(wrapper, onComplete);
            else wrapper.remove();
        }

        hideFrame(frame: SimFrame, onComplete?: () => void) {
            this.options.hideElement((frame as DomSimFrame).wrapper, onComplete);
        }

        unhideFrame(frame: SimFrame) {
            this.options.unhideElement((frame as DomSimFrame).wrapper);
        }

        removeAllFrames() {
            pxsim.U.removeChildren(this.container);
        }

        revealFrame(frame: SimFrame) {
            if (this.options.revealElement)
                this.options.revealElement((frame as DomSimFrame).element);
        }

        post(frame: SimFrame, msg: SimulatorMessage) {
            const element = (frame as DomSimFrame).element;
            const origin = U.isLocalHostDev() ? "*" : frame.origin;
            element.contentWindow.postMessage(msg, origin);
        }

        setFrameAppearance(frame: SimFrame, state: SimulatorState, appearance: SimFrameAppearance) {
            const element = (frame as DomSimFrame).element;
            const icon = element.nextElementSibling as HTMLElement;
            const loader = icon.nextElementSibling as HTMLElement;
            switch (state) {
                case SimulatorState.Pending:
                case SimulatorState.Starting:
                    icon.style.display = '';
                    icon.className = '';
                    loader.style.display = '';
                    break;
                case SimulatorState.Stopped:
                case SimulatorState.Suspended:
                    pxsim.U.addClass(element,
                        (state == SimulatorState.Stopped || appearance.autoRun)
                            ? appearance.stoppedClass : appearance.invalidatedClass);
                    if (!appearance.autoRun) {
                        icon.style.display = '';
                        icon.className = 'videoplay xicon icon';
                    } else
                        icon.style.display = 'none';
                    loader.style.display = 'none';
                    break;
                default:
                    pxsim.U.removeClass(element, appearance.stoppedClass);
                    pxsim.U.removeClass(element, appearance.invalidatedClass);
                    icon.style.display = 'none';
                    loader.style.display = 'none';
                    break;
            }
        }

        setAspectRatio(frame: SimFrame, ratio: number) {
            (frame as DomSimFrame).wrapper.style.paddingBottom = (100 / ratio) + "%";
        }

        freeze(value: boolean) {
            const cls = "pause-overlay";
            if (!value) {
                pxsim.util.toArray(this.container.querySelectorAll(`div.simframe div.${cls}`))
                    .forEach(overlay => overlay.parentElement.removeChild(overlay));
            } else {
                pxsim.util.toArray(this.container.querySelectorAll("div.simframe"))
                    .forEach(frame => {
                        if (frame.querySelector(`div.${cls}`))
                            return;
                        const div = document.createElement("div");
                        div.className = cls;
                        div.onclick = (ev) => {
                            ev.preventDefault();
                            return false;
                        };
                        frame.appendChild(div);
                    })
            }
        }

        setDimmed(value: boolean) {
            if (value) this.container.style.opacity = "0.3";
            else delete this.container.style.opacity;
        }

        // A simulator can be lent out to be hosted anywhere in the page. While one is
        // loaned, the frames in the container are suspended by the driver.

        isLoanedFrame(el: HTMLElement) {
            return !!this.loanedSimulator && this.loanedIFrame() == el;
        }

        /** Lends out the first board frame, or a new one made by `create`. */
        loanSimulator(create: () => SimFrame): HTMLDivElement {
            if (this.loanedSimulator) return this.loanedSimulator;

            const main = this.frames(true).find(frame => !frame.messageChannel) as DomSimFrame;
            this.loanedSimulator = (main || create() as DomSimFrame).wrapper;
            if (this.loanedSimulator.parentNode)
                this.container.removeChild(this.loanedSimulator);
            return this.loanedSimulator;
        }

        unloanSimulator() {
            if (this.loanedSimulator) {
                if (this.loanedSimulator.parentNode)
                    this.loanedSimulator.parentNode.removeChild(this.loanedSimulator);
                this.container.insertBefore(this.loanedSimulator, this.container.firstElementChild);
                delete this.loanedSimulator;
            }
        }

        private loanedIFrame(): HTMLIFrameElement {
            return this.loanedSimulator
                && this.loanedSimulator.parentNode
                && this.loanedSimulator.querySelector("iframe");
        }
    }
}
