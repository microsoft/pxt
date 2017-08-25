/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler";

import * as codecard from "./codecard"
import * as gallery from "./gallery";
import * as ext from "./extensionManager";

type ISettingsProps = pxt.editor.ISettingsProps;

const CUSTOM_CONTENT_DIV = 'custom-content';

interface ExtensionsState {
    visible?: boolean;
    extension?: string;
    url?: string;
    consent?: boolean;
}

export class Extensions extends data.Component<ISettingsProps, ExtensionsState> implements ext.ExtensionHost {
    private packagesConfig: pxt.PackagesConfig;
    private extensionWrapper: HTMLDivElement;
    private manager: ext.ExtensionManager;

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false,
            consent: false
        }
        this.manager = new ext.ExtensionManager(this);
    }

    hide() {
        this.setState({ visible: false});

        const frame = Extensions.getFrame(this.state.extension);
        frame.style.display = 'none';
    }

    showExtension(extension: string, url: string, consentRequired: boolean) {
        let consent = consentRequired ? this.manager.hasConsent(this.manager.getExtId(extension)) : true;
        this.setState({ visible: true, extension: extension, url: url, consent: consent});
    }

    submitConsent() {
        this.manager.setConsent(this.manager.getExtId(this.state.extension), true);
        this.setState({consent: true});
    }

    initializeFrame() {
        this.manager.setConsent(this.manager.getExtId(this.state.extension), true);
        const frame = Extensions.getFrame(this.state.extension);
        frame.style.display = 'block';
        if (!frame.src) {
            frame.src = this.state.url;
        }
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ExtensionsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.extension != nextState.extension
            || this.state.consent != nextState.consent;
    }

    private updateDimensions() {
        if (this.extensionWrapper) {
            // Resize current frame
            const extension = this.extensionWrapper.getAttribute('data-frame');
            if (extension) {
                const frame = Extensions.getFrame(extension);
                const extensionDialog = document.getElementsByClassName('extensiondialog')[0];
                if (extensionDialog && frame) {
                    const bb = extensionDialog.getBoundingClientRect();
                    frame.width = `${this.extensionWrapper.clientWidth}px`;
                    frame.height = `${this.extensionWrapper.clientHeight}px`;
                    frame.style.top = `${bb.top + this.extensionWrapper.offsetTop}px`;
                    frame.style.left = `${bb.left + this.extensionWrapper.offsetLeft}px`;
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
        this.updateDimensions();
    }

    handleExtensionRequest(request: pxt.editor.ExtensionRequest) {
        this.manager.handleExtensionMessage(request);
    }

    send(name: string, editorMessage: pxt.editor.ExtensionMessage) {
        const frame = Extensions.getFrame(name);
        if (frame) {
            frame.contentWindow.postMessage(editorMessage, "*");
        }
        else {
            console.warn(`Attempting to post message to unloaded extesnion ${name}`);
        }
    }

    promptForPermissionAsync(id: string, permission: ext.Permissions): Promise<boolean> {
        // TODO
        return Promise.resolve(false);
    }

    static getCustomContent() {
        return document.getElementById(CUSTOM_CONTENT_DIV) as HTMLElement;
    }

    static getFrame(name: string): HTMLIFrameElement {
        const customContent = this.getCustomContent();
        let frame = customContent.getElementsByClassName(`extension-frame-${name}`)[0] as HTMLIFrameElement;
        if (!frame) {
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
        frame.sandbox.value = "allow-scripts allow-same-origin"
        let frameUrl = '';
        frame.frameBorder = "0";
        frame.style.display = "none";

        wrapper.appendChild(frame);
        return frame;
    }

    renderCore() {
        const {visible, extension, url, consent} = this.state;
        const needsConsent = !consent;
        const theme = pxt.appTarget.appTheme;

        const action = needsConsent ? lf("Agree") : undefined;
        const actionClick = () => {
            this.submitConsent();
        };
        if (!needsConsent && visible) this.initializeFrame();
        return (
            <sui.Modal open={visible} className={`${needsConsent ? 'extensionconsentdialog' : 'extensiondialog'}`} size="fullscreen" closeIcon={false}
                onClose={() => this.hide() } dimmer={true}
                action={action}
                actionClick={actionClick}
                onPositionChanged={() => this.updateDimensions()}
                closeOnDimmerClick>
                {consent ?
                    <div id="extensionWrapper" data-frame={extension} ref={v => this.extensionWrapper = v}></div>
                :   <div>
                        <div className="ui form">
                            <div className="ui icon violet message">
                                <i className="user icon"></i>
                                <div className="content">
                                    <h3 className="header">
                                        User-provided content
                                    </h3>
                                    <p>
                                        {lf("This content is provided by a user, and is not endorsed by Microsoft.")}
                                        <br />
                                        {lf("If you think it's not appropriate, please report abuse through Settings -> Report Abuse.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>}
            </sui.Modal>
        );
    }
}
