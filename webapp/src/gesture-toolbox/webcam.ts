const MediaStreamRecorder = require("msr");

export let nav = navigator as any;
export let mediaStream: any;
export let mediaRecorder: any;

export function init(webcam_id: string) {
    nav.getUserMedia  = nav.getUserMedia || nav.webkitGetUserMedia ||
                        nav.mozGetUserMedia || nav.msGetUserMedia;

    if (nav.getUserMedia) {
        nav.getUserMedia({audio: false, video: true},
            (stream: any) => {
                let video = document.getElementById(webcam_id) as any;
                video.autoplay = true;
                video.src = window.URL.createObjectURL(stream);
                mediaStream = stream;

                mediaRecorder = new MediaStreamRecorder(stream);
                mediaRecorder.mimeType = 'video/mp4';
            }, () => {
                console.error('unable to initialize webcam');
            });
    }
}