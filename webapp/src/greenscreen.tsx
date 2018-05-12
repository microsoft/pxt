import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui";
import * as core from "./core";

export interface WebCamProps {
    close: () => void;
}

export function isSupported(): boolean {
    return navigator
        && !!navigator.mediaDevices
        && !!navigator.mediaDevices.enumerateDevices
        && !!navigator.mediaDevices.getUserMedia;
}

export class WebCam extends sui.UIElement<WebCamProps, {}> {
    private deviceId: string;
    private stream: MediaStream;
    private v: HTMLVideoElement;

    componentDidMount() {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                core.dialogAsync({
                    header: lf("Choose a camera"),
                    buttons: devices.filter(device => device.kind == "videoinput")
                        .map((device, di) => {
                            return {
                                label: device.label || lf("camera {0}", di),
                                onclick: () => {
                                    this.deviceId = device.deviceId;
                                    navigator.mediaDevices.getUserMedia({
                                        video: { deviceId: { exact: device.deviceId } },
                                        audio: false
                                    }).then(stream => {
                                        this.stream = stream;
                                        this.v.srcObject = this.stream;
                                        this.v.play();
                                    }, err => {
                                        this.stop();
                                    })
                                }
                            } as sui.ModalButton;
                        })
                }).done(() => {
                    if (!this.deviceId)
                        this.props.close();
                });
            })
    }

    componentWillUnmount() {
        this.stop();
    }

    private stop() {
        this.deviceId = undefined;
        if (this.stream) {
            if (this.stream.stop)
                this.stream.stop();
            const tracks = this.stream.getTracks();
            if (tracks)
                tracks.forEach(track => track.stop());
            this.stream = undefined;
            this.v.srcObject = undefined;
        }
    }

    private handleVideoRef = (ref: any) => {
        this.v = ref;
    }

    render() {
        return <video ref={this.handleVideoRef} />
    }
}