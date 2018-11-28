import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

export interface WebCamProps {
    close: () => void;
}

export interface WebCamState {
    devices?: MediaDeviceInfo[];
    hasPrompt?: boolean;
    userFacing?: boolean;
}

export function isSupported(): boolean {
    return typeof navigator !== undefined
        && !!navigator.mediaDevices
        && !!navigator.mediaDevices.enumerateDevices
        && !!navigator.mediaDevices.getUserMedia;
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

    handleDeviceClick(deviceId: any) {
        this.setState({ hasPrompt: false });
        this.deviceId = deviceId;
        // deviceId is "" if green screen selected
        if (this.deviceId) {
            navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false
            }).then(stream => {
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
                    pxt.debug(`greenscreen: play failed, ${e}`)
                    this.stop();
                }
            }, err => {
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
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                this.setState({ devices: devices.filter(device => device.kind == "videoinput") });
            })
    }

    componentWillUnmount() {
        this.stop();
    }

    private stop() {
        this.deviceId = undefined;
        if (this.stream) {
            try {
                if (this.stream.stop)
                    this.stream.stop();
            } catch (e) { }
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
            <video className={userFacing ? "flipx" : ""} autoPlay playsInline ref={this.handleVideoRef} />
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
    deviceId: any;
    onClick: (deviceId: any) => void;
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
        return <div role="button" className="ui card link" onClick={this.handleClick}>
            <div className="imageicon">
                <sui.Icon icon={`${icon} massive`} />
            </div>
            <div className="content">
                <span className="header">{header}</span>
            </div>
        </div>
    }
}