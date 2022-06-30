
import { classList, ControlProps } from "../util";
import { useRef, useEffect } from 'react';
import * as React from 'react';
import { MediaPlayer } from "dashjs";

export interface EmbedVideoProps extends ControlProps {
    src: "youtube" | "streams";
    id: string;
    autoplay?: boolean;
    allowFullScreen?: boolean;
}

export const EmbedVideo = (props: EmbedVideoProps) => {
    const {
        src,
        id,
        autoplay,
        allowFullScreen
    } = props;

    let videoURL: string;

    if (src == "youtube") {

        videoURL = `https://www.youtube.com/embed/${id}?${autoplay ? "autoplay=1" : ""}`;
        let appending = "";
        if (autoplay) {
            appending = "; autoplay";
        }

        let st1 = "encrypted-media; picture-in-picture";
        if (pxt.BrowserUtils.isIOS()) {
            st1 += "; muted=true";
        }
        let st2 = st1 + appending;

        return (
            <div className={classList("common-video")}>
                <iframe src={videoURL} title="YouTube video player"
                    frameBorder="0" allow={st2} allowFullScreen={allowFullScreen}></iframe>
            </div>
        );

    } else {

        videoURL = `https://makecode-lucas-testing-makecodetempmediaservice-usea.streaming.media.azure.net/${id}/manifest(format=mpd-time-cmaf)`;

        const videoRef = useRef<HTMLVideoElement>(null)
        useEffect(() => {
            let player = MediaPlayer().create()
            if (videoRef.current) {
                player.initialize(videoRef.current, videoURL);
            }
            return () => {
                player.reset();
            };
        }, [videoRef])

        return (
            <div >
                <video className={classList("common-video")} controls ref={videoRef} />
            </div>
        );
    }

}