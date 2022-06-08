import * as React from "react";
import { classList, ControlProps } from "../util";

export interface EmbedVideoProps extends ControlProps {
  src: "youtube" | "streams";
  id: string;
  autoplay?: boolean;
  allowFullScreen?: boolean;
//   encryptedmedia?: boolean;

}



export const EmbedVideo = (props: EmbedVideoProps) => {
    const {
       src,
       id,
       autoplay,
       allowFullScreen

    } = props;



    let videoURL = `https://www.youtube.com/embed/${id}?${autoplay ? "autoplay=1" : ""}`;
    let streamURL= `https://msit.microsoftstream.com/video/${id}`;

    if (src=="streams"){
        videoURL=streamURL;
    }

    let appending="";

    if (autoplay){
        appending="; autoplay";
    }

    let st1="encrypted-media; picture-in-picture";

    let st2=st1+appending;

    return (
        <div className={classList("common-embed-video-wrapper")}>
           <iframe src={videoURL} title="YouTube video player" 
            frameBorder="0" allow={st2} allowFullScreen={allowFullScreen}></iframe>

            {/* should i change allowFullScreen to make boolean */}

        </div>
    );
}