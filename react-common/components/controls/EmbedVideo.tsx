
import { classList, ControlProps } from "../util";
import { useRef, useEffect } from 'react';
import * as React from 'react';  //can i have these on separate lines?
import { MediaPlayer } from "dashjs";
import * as dashjs from "dashjs" //same question as above

export interface EmbedVideoProps extends ControlProps {
    src: "youtube" | "streams"; //is | considered or? though it would be ||
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

        //should i make this an else if and handle case where either weren't entered?
    } else {

        videoURL = "https://makecode-lucas-testing-makecodetempmediaservice-usea.streaming.media.azure.net/a6dd2090-b963-490c-bc5d-cdeecdee2c6e/WIN_20220622_17_44_45_Pro.ism/manifest(format=mpd-time-cmaf)";

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



    return (
        <div className={classList("common-embed-video-wrapper")}>
            {/* <iframe src={videoURL} title="YouTube video player"
            frameBorder="0" allow={st2} allowFullScreen={allowFullScreen}></iframe> */}

            <video controls>
                <source src={videoURL} type="application/dash+xml" />
            </video>
        </div>
    );
}