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

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ExtensionsState {
    visible?: boolean;
    extension?: string;
    url?: string;
    consent?: boolean;
    permissionRequest?: ext.Permissions[];
    permissionExtName?: string;
}

export class Extensions extends data.Component<ISettingsProps, ExtensionsState> implements ext.ExtensionHost {
    private packagesConfig: pxt.PackagesConfig;
    private extensionWrapper: HTMLDivElement;
    private manager: ext.ExtensionManager;

    private permissionCb: (approved: boolean) => void;

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false,
            consent: false
        }
        this.manager = new ext.ExtensionManager(this);
        window.addEventListener("message", this.processMessage.bind(this), false)
    }

    processMessage(ev: MessageEvent) {
        const msg = ev.data
        if (msg.type !== "serial") return;

        const smsg = msg as pxsim.SimulatorSerialMessage
        const exts = this.manager.streamingExtensions();
        if (!exts || !exts.length) return;

        const data = smsg.data || ""
        const source = smsg.id || "?"

        // called by app when a serial entry is read
        exts.forEach(n => {
            this.send(n, {
                type: "pxtpkgext",
                event: "extconsole",
                body: {
                    source,
                    sim: smsg.sim,
                    data
                }
            } as pxt.editor.ConsoleEvent);
        })
    }

    hide() {
        this.setState({ visible: false });

        const frame = Extensions.getFrame(this.state.extension, true);
        frame.style.display = 'none';

        // reload project to update changes from the editor
        this.props.parent.reloadHeaderAsync()
            .done(() => {
                this.send(this.state.extension, { type: "pxtpkgext", event: "exthidden" } as pxt.editor.HiddenEvent);
            });
    }

    showExtension(extension: string, url: string, consentRequired: boolean) {
        let consent = consentRequired ? this.manager.hasConsent(this.manager.getExtId(extension)) : true;
        this.setState({ visible: true, extension: extension, url: url, consent: consent }, () => {
            this.send(extension, { type: "pxtpkgext", event: "extshown" } as pxt.editor.ShownEvent);
        })
    }

    submitConsent() {
        this.manager.setConsent(this.manager.getExtId(this.state.extension), true);
        this.setState({ consent: true });
    }

    initializeFrame() {
        this.manager.setConsent(this.manager.getExtId(this.state.extension), true);
        const frame = Extensions.getFrame(this.state.extension, true);
        frame.style.display = 'block';
        if (!frame.src) {
            frame.src = this.state.url + "#" + this.manager.getExtId(this.state.extension);
        }
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ExtensionsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.extension != nextState.extension
            || this.state.permissionRequest != nextState.permissionRequest
            || this.state.consent != nextState.consent;
    }

    private updateDimensions() {
        if (this.extensionWrapper) {
            // Resize current frame
            const extension = this.extensionWrapper.getAttribute('data-frame');
            if (extension) {
                const frame = Extensions.getFrame(extension, false);
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
        const frame = Extensions.getFrame(name, false);
        if (frame) {
            frame.contentWindow.postMessage(editorMessage, "*");
        }
        else {
            console.warn(`Attempting to post message to unloaded extesnion ${name}`);
        }
    }

    promptForPermissionAsync(id: string, permissions: ext.Permissions[]): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.permissionCb = resolve;
            this.setState({
                permissionRequest: permissions,
                permissionExtName: id
            });
        });
    }

    private onPermissionDecision(approved: boolean) {
        this.permissionCb(approved);
        this.permissionCb = undefined;
        this.setState({
            permissionRequest: null,
            permissionExtName: null
        });
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
        frame.sandbox.value = "allow-scripts allow-same-origin"
        let frameUrl = '';
        frame.frameBorder = "0";
        frame.style.display = "none";

        wrapper.appendChild(frame);
        return frame;
    }

    getIconForPermission(permission: ext.Permissions) {
        switch (permission) {
            case ext.Permissions.Console:
                return "terminal"
            case ext.Permissions.ReadUserCode:
                return "code";
        }
        return "";
    }

    getDisplayNameForPermission(permission: ext.Permissions) {
        switch (permission) {
            case ext.Permissions.Console:
                return lf("Console output")
            case ext.Permissions.ReadUserCode:
                return lf("Read your code");
        }
        return "";
    }

    getDescriptionForPermission(permission: ext.Permissions) {
        switch (permission) {
            case ext.Permissions.Console:
                return lf("The extension will be able to read any console output (including device data) streamed to the editor")
            case ext.Permissions.ReadUserCode:
                return lf("The extension will be able to read the code in the current project");
        }
        return "";
    }

    renderCore() {
        const { visible, extension, url, consent, permissionRequest, permissionExtName } = this.state;
        const needsConsent = !consent;
        const theme = pxt.appTarget.appTheme;

        const action = needsConsent ? lf("Agree") : undefined;
        const actionClick = () => {
            this.submitConsent();
        };
        const actions = action ? [{ label: action, onClick: actionClick }] : undefined;
        if (!needsConsent && visible) this.initializeFrame();
        return (
            <sui.Modal open={visible} className={`${needsConsent ? 'extensionconsentdialog' : 'extensiondialog'}`} size="fullscreen" closeIcon={false}
                onClose={() => this.hide()} dimmer={true}
                actions={actions}
                onPositionChanged={() => this.updateDimensions()}
                closeOnDimmerClick>
                {consent ?
                    <div id="extensionWrapper" data-frame={extension} ref={v => this.extensionWrapper = v}>
                        {permissionRequest ?
                            <sui.Modal className="extensionpermissiondialog basic" size="fullscreen" closeIcon={false} dimmer={true} open={true} dimmerClassName="permissiondimmer">
                                <div className="permissiondialoginner">
                                    <div className="permissiondialogheader">
                                        {lf("Permission Request")}
                                    </div>
                                    <div className="permissiondialogbody">
                                        {lf("Extension {0} is requesting the following permission(s):", permissionExtName)}
                                    </div>
                                    <div className="ui inverted list">
                                        {permissionRequest.map(permission =>
                                            <div className="item">
                                                <sui.Icon icon={`${this.getIconForPermission(permission)} icon`} />
                                                <div className="content">
                                                    <div className="header">{this.getDisplayNameForPermission(permission)}</div>
                                                    <div className="description">{this.getDescriptionForPermission(permission)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="actions">
                                    <sui.Button text={lf("Deny")} class={`deny inverted`}
                                        onClick={() => this.onPermissionDecision(false)} />
                                    <sui.Button text={lf("Approve")} class={`approve inverted green`}
                                        onClick={() => this.onPermissionDecision(true)} />
                                </div>
                            </sui.Modal>
                            : undefined
                        }
                    </div>
                    : <div>
                        <div className="ui form">
                            <div className="ui icon violet message">
                                <sui.Icon icon="user" />
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
