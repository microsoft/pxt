/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as core from "./core";
import * as sui from "./sui";
import * as ext from "./extensionManager";

import ISettingsProps = pxt.editor.ISettingsProps;

const CUSTOM_CONTENT_DIV = 'custom-content';

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ExtensionsState {
    visible?: boolean;
    extension?: string;
    url?: string;
}

export class Extensions extends data.Component<ISettingsProps, ExtensionsState> implements ext.ExtensionHost {
    private extensionWrapper: HTMLDivElement;
    private manager: ext.ExtensionManager;

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false
        }
        this.manager = new ext.ExtensionManager(this);
        window.addEventListener("message", this.processMessage.bind(this), false)

        this.hide = this.hide.bind(this);
        this.updateDimensions = this.updateDimensions.bind(this);
    }

    unload() {
        // forget everythings
        const wrapper = Extensions.getCustomContent();
        if (wrapper)
            pxsim.U.removeChildren(wrapper);
        this.manager.clear();
    }

    private processSerialMessage(smsg: pxsim.SimulatorSerialMessage) {
        const exts = this.manager.streamingExtensions();
        if (!exts?.length)
            return;

        const data = smsg.data || ""
        const source = smsg.id || "?"
        const resp = {
            target: pxt.appTarget.id,
            type: "pxtpkgext",
            event: "extconsole",
            body: {
                source,
                sim: smsg.sim,
                data
            }
        } as pxt.editor.ConsoleEvent;
        exts.forEach(n => this.send(n, resp))
    }

    private processMessagePacketMessage(smsg: pxsim.SimulatorControlMessage) {
        const exts = this.manager.messagesExtensions();
        if (!exts?.length)
            return;

        const data = smsg.data
        const channel = smsg.channel
        const source = smsg.source
        const resp = {
            target: pxt.appTarget.id,
            type: "pxtpkgext",
            event: "extmessagepacket",
            body: {
                source,
                channel,
                data
            }
        } as pxt.editor.MessagePacketEvent;
        exts.forEach(n => this.send(n, resp))
    }

    processMessage(ev: MessageEvent) {
        const msg = ev.data
        if (msg?.type === "serial")
            this.processSerialMessage(msg);
        else if (msg?.type === "messagepacket")
            this.processMessagePacketMessage(msg);
    }

    hide() {
        this.setState({ visible: false });

        const frame = Extensions.getFrame(this.state.extension, true);
        frame.style.display = 'none';

        // reload project to update changes from the editor
        core.showLoading("reloadproject", lf("loading..."));
        this.send(this.state.extension, { target: pxt.appTarget.id, type: "pxtpkgext", event: "exthidden" } as pxt.editor.HiddenEvent);
        this.props.parent.reloadHeaderAsync()
            .then(() => core.hideLoading("reloadproject"));
    }

    showExtensionAsync(extension: string, url: string) {
        this.setState({ visible: true, extension: extension, url: url }, () => {
            this.send(extension, {
                target: pxt.appTarget.id,
                type: "pxtpkgext",
                event: "extshown"
            } as pxt.editor.ShownEvent);
        })
    }

    initializeFrame() {
        const frame = Extensions.getFrame(this.state.extension, true);
        frame.style.display = 'block';
        if (!frame.src) {
            frame.src = this.state.url + "#" + this.manager.getExtId(this.state.extension);
            frame.onload = () => {
                this.send(this.state.extension, { target: pxt.appTarget.id, type: "pxtpkgext", event: "extloaded" } as pxt.editor.LoadedEvent);
            }
        }
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ExtensionsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.extension != nextState.extension
    }

    private updateDimensions() {
        if (this.extensionWrapper) {
            // Resize current frame to fit full screen
            const topOffsetHeight = 60; //px
            const extension = this.extensionWrapper.getAttribute('data-frame');
            if (extension) {
                const frame = Extensions.getFrame(extension, false);
                const extensionDialog = document.getElementsByClassName('extensiondialog')[0];
                if (extensionDialog && frame) {
                    const bb = extensionDialog.getBoundingClientRect();
                    frame.width = `${window.innerWidth}px`;
                    frame.height = `${window.innerHeight - topOffsetHeight}px`;
                    frame.style.top = `${topOffsetHeight}px`;
                    frame.style.left = `${0}px`;
                }
            }
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.updateDimensions);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateDimensions);
    }

    componentDidUpdate() {
        setTimeout(() => {
            this.updateDimensions();
        }, 0);
    }

    UNSAFE_componentWillUpdate(nextProps: any, nextState: ExtensionsState) {
        if (nextState.extension && nextState.visible) {
            // Start rendering the iframe earlier
            const frame = Extensions.getFrame(nextState.extension, true);
        }
    }

    handleExtensionRequest(request: pxt.editor.ExtensionRequest) {
        this.manager.handleExtensionMessage(request);
    }

    send(name: string, editorMessage: pxt.editor.ExtensionMessage) {
        const frame = Extensions.getFrame(name, false);
        if (frame) {
            frame.contentWindow.postMessage(editorMessage, "*");
        }
        else {
            pxt.warn(`Attempting to post message to unloaded extesnion ${name}`);
        }
    }

    static getCustomContent() {
        return document.getElementById(CUSTOM_CONTENT_DIV) as HTMLElement;
    }

    static getFrame(name: string, createIfMissing: boolean): HTMLIFrameElement {
        const customContent = this.getCustomContent();
        let frame = customContent.getElementsByClassName(`extension-frame-${name}`)[0] as HTMLIFrameElement;
        if (!frame && createIfMissing) {
            frame = this.createFrame(name);
        }
        return frame;
    }

    static createFrame(name: string): HTMLIFrameElement {
        const wrapper = this.getCustomContent();

        const frame = document.createElement('iframe') as HTMLIFrameElement;
        frame.className = `extension-frame extension-frame-${name}`;
        frame.allowFullscreen = true;
        frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        frame.frameBorder = "0";
        frame.style.display = "none";

        wrapper.appendChild(frame);
        return frame;
    }

    static hideAllFrames() {
        const customContent = this.getCustomContent();
        if (customContent) {
            pxt.Util.toArray(customContent.getElementsByClassName(`extension-frame`)).forEach((frame: HTMLIFrameElement) => {
                frame.style.zIndex = '10';
            })
        }
    }

    static showAllFrames() {
        const customContent = this.getCustomContent();
        if (customContent) {
            pxt.Util.toArray(customContent.getElementsByClassName(`extension-frame`)).forEach((frame: HTMLIFrameElement) => {
                frame.style.zIndex = '';
            })
        }
    }


    private handleExtensionWrapperRef = (c: HTMLDivElement) => {
        this.extensionWrapper = c;
    }

    renderCore() {
        const { visible, extension } = this.state;

        Extensions.showAllFrames();

        if (visible) this.initializeFrame();
        return (
            <sui.Modal isOpen={visible} className={"extensiondialog"}
                size={'fullscreen'} closeIcon={true}
                onClose={this.hide} dimmer={true}
                modalDidOpen={this.updateDimensions} shouldFocusAfterRender={false}
                onPositionChanged={this.updateDimensions}
                closeOnDimmerClick>
                <div id="extensionWrapper"
                    data-frame={extension}
                    ref={this.handleExtensionWrapperRef}>
                </div>
            </sui.Modal>
        );
    }
}
