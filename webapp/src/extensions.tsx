/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as core from "./core";
import * as sui from "./sui";
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

        this.hide = this.hide.bind(this);
        this.updateDimensions = this.updateDimensions.bind(this);
        this.onApprovedDecision = this.onApprovedDecision.bind(this);
        this.onDeniedDecision = this.onDeniedDecision.bind(this);
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
                target: pxt.appTarget.id,
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
        core.showLoading("reloadproject", lf("loading..."));
        this.props.parent.reloadHeaderAsync()
            .done(() => {
                this.send(this.state.extension, { target: pxt.appTarget.id, type: "pxtpkgext", event: "exthidden" } as pxt.editor.HiddenEvent);
                core.hideLoading("reloadproject");
            });
    }

    showExtension(extension: string, url: string, consentRequired: boolean) {
        let consent = consentRequired ? this.manager.hasConsent(this.manager.getExtId(extension)) : true;
        this.setState({ visible: true, extension: extension, url: url, consent: consent }, () => {
            this.send(extension, { target: pxt.appTarget.id, type: "pxtpkgext", event: "extshown" } as pxt.editor.ShownEvent);
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
            frame.onload = () => {
                this.send(this.state.extension, { target: pxt.appTarget.id, type: "pxtpkgext", event: "extloaded" } as pxt.editor.LoadedEvent);
            }
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

    componentWillUpdate(nextProps: any, nextState: ExtensionsState) {
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

    private onApprovedDecision() {
        this.onPermissionDecision(true);
    }
    private onDeniedDecision() {
        this.onPermissionDecision(false);
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

    private handleExtensionWrapperRef = (c: HTMLDivElement) => {
        this.extensionWrapper = c;
    }

    renderCore() {
        const { visible, extension, consent, permissionRequest, permissionExtName } = this.state;
        const needsConsent = !consent;

        if (permissionRequest) {
            Extensions.hideAllFrames();
        } else {
            Extensions.showAllFrames();
        }

        const action = needsConsent ? lf("Agree") : undefined;
        const actionClick = () => {
            this.submitConsent();
        };
        const actions: sui.ModalButton[] = action ? [{ label: action, onclick: actionClick }] : undefined;
        if (!needsConsent && visible) this.initializeFrame();
        return (
            <sui.Modal isOpen={visible} className={`${needsConsent ? 'extensionconsentdialog' : 'extensiondialog'}`}
                size={needsConsent ? 'small' : 'fullscreen'} closeIcon={true}
                onClose={this.hide} dimmer={true} buttons={actions}
                modalDidOpen={this.updateDimensions} shouldFocusAfterRender={false}
                onPositionChanged={this.updateDimensions}
                closeOnDimmerClick>
                {consent ?
                    <div id="extensionWrapper" data-frame={extension} ref={this.handleExtensionWrapperRef}>
                        {permissionRequest ?
                            <sui.Modal isOpen={true} className="extensionpermissiondialog basic" closeIcon={false} dimmer={true} dimmerClassName="permissiondimmer">
                                <div className="permissiondialoginner">
                                    <div className="permissiondialogheader">
                                        {lf("Permission Request")}
                                    </div>
                                    <div className="permissiondialogbody">
                                        {lf("Extension {0} is requesting the following permission(s):", permissionExtName)}
                                    </div>
                                    <div className="ui inverted list">
                                        {permissionRequest.map(permission =>
                                            <div key={permission.toString()} className="item">
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
                                    <sui.Button text={lf("Deny")} className={`deny inverted`}
                                        onClick={this.onDeniedDecision} />
                                    <sui.Button text={lf("Approve")} className={`approve inverted green`}
                                        onClick={this.onApprovedDecision} />
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
                                        {lf("User-provided content")}
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
