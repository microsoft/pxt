import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import { fireClickOnEnter } from "./util";

export interface WebCamProps {
    close: () => void;
}

export interface WebCamState {
    devices?: MediaDeviceInfo[];
    hasPrompt?: boolean;
    userFacing?: boolean;
}

function isMediaDevicesSupported(): boolean {
    return typeof navigator !== undefined
        && !!navigator.mediaDevices
        && !!navigator.mediaDevices.enumerateDevices
        && !!navigator.mediaDevices.getUserMedia
        && !(pxt.BrowserUtils.isPxtElectron() && pxt.BrowserUtils.isMac());
}

export class WebCam extends data.Component<WebCamProps, WebCamState> {
    private deviceId: string;
    private stream: MediaStream;
    private video: HTMLVideoElement;

    constructor(props: WebCamProps) {
        super(props);
        this.state = {
            hasPrompt: true
        }

        this.handleDeviceClick = this.handleDeviceClick.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    handleDeviceClick(deviceId: string) {
        this.setState({ hasPrompt: false });
        pxt.debug(`greenscreen: start`)
        this.deviceId = deviceId;
        // deviceId is "" if green screen selected
        if (this.deviceId) {
            navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false
            }).then(stream => {
                pxt.debug(`greenscreen: stream acquired`)
                try {
                    this.stream = stream;
                    this.video.srcObject = this.stream;
                    this.video.play();
                    // store info
                    const track = this.stream.getVideoTracks()[0];
                    if (track) {
                        const settings = track.getSettings();
                        // https://w3c.github.io/mediacapture-main/#dom-videofacingmodeenum
                        const userFacing = settings.facingMode !== "environment";
                        this.setState({ userFacing });
                    }
                }
                catch (e) {
                    pxt.debug(`greenscreen: play failed`)
                    pxt.error(e)
                    this.stop();
                }
            }, err => {
                pxt.debug(`greenscreen: get camera failed`)
                pxt.error(err)
                this.stop();
            })
        }
    }

    handleClose() {
        if (!this.deviceId) {
            this.props.close();
        }
    }

    componentDidMount() {
        if (isMediaDevicesSupported()) {
            // first ask for permission from ther user so that
            // labels are populated in enumerateDevices
            navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                .then(() => navigator.mediaDevices.enumerateDevices())
                .then(devices => {
                    this.setState({ devices: devices.filter(device => device.kind == "videoinput") });
                }, e => {
                    pxt.debug(`greenscreen: enumerate devices failed`)
                    pxt.error(e);
                });
        }
    }

    componentWillUnmount() {
        this.stop();
    }

    private stop() {
        this.deviceId = undefined;
        if (this.stream) {
            try {
                const tracks = this.stream.getTracks();
                if (tracks)
                    tracks.forEach(track => track.stop());
            } catch (e) { }
            this.stream = undefined;
        }
        if (this.video) {
            try {
                this.video.srcObject = undefined;
            } catch (e) { }
        }
    }

    private handleVideoRef = (ref: any) => {
        this.video = ref;
    }

    render() {
        // playsInline required for iOS
        const { hasPrompt, devices, userFacing } = this.state;

        return <div className="videoContainer">
            <video className={userFacing ? "flipx" : ""} autoPlay playsInline ref={this.handleVideoRef} width="100%" />
            {hasPrompt ?
                <sui.Modal isOpen={hasPrompt} onClose={this.handleClose} closeIcon={true}
                    dimmer={true} header={lf("Choose a camera")}>
                    <div className={`ui cards ${!devices ? 'loading' : ''}`}>
                        <WebCamCard
                            key={`devicegreenscreen`}
                            icon='green tint'
                            onClick={this.handleDeviceClick}
                            deviceId={""} header={lf("Green background")} />
                        {devices && devices
                            .map((device, di) =>
                                <WebCamCard
                                    key={`device${di}`}
                                    icon='video camera'
                                    onClick={this.handleDeviceClick}
                                    deviceId={device.deviceId} header={device.label || lf("camera {0}", di)} />
                            )}
                    </div>
                </sui.Modal>
                : undefined}
        </div>
    }
}


interface WebCamCardProps {
    header: string;
    icon: string;
    deviceId: string;
    onClick: (deviceId: string) => void;
}

class WebCamCard extends data.Component<WebCamCardProps, {}> {

    constructor(props: WebCamCardProps) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { deviceId, onClick } = this.props;
        onClick(deviceId);
    }

    renderCore() {
        const { header, icon } = this.props;
        return <div role="button" className="ui card link" tabIndex={0} onClick={this.handleClick} onKeyDown={fireClickOnEnter}>
            <div className="imageicon">
                <sui.Icon icon={`${icon} massive`} />
            </div>
            <div className="content">
                <span className="header">{header}</span>
            </div>
        </div>
    }
}
