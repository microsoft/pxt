import * as React from "react";
import { classList } from "../../../../react-common/components/util";
import { addPlaybackStopListener, addTickListener, removePlaybackStopListener, removeTickListener, tickToMs } from "./playback";
import { beatToX, CLEF_HEIGHT, rowY, STAFF_HEADER_FONT_SIZE, STAFF_HEADER_HEIGHT, STAFF_HEADER_OFFSET, tickToX, workspaceWidth, WORKSPACE_HEIGHT } from "./svgConstants";

export interface StaffProps {
    song: pxt.assets.music.Song;
}

export const Staff = (props: StaffProps) => {
    const { song } = props;

    let playbackHead: SVGGElement;

    React.useEffect(() => {
        const tickTime = tickToMs(song, 1);
        const tickDistance = tickToX(song, 2) - tickToX(song, 1);
        let playbackHeadPosition = 0;
        let isPlaying = false;
        let animationFrameRef: number;
        let lastTime: number;

        const onTick = (tick: number) => {
            playbackHeadPosition = tickToX(song, tick)
            lastTime = Date.now();
            if (!isPlaying) {
                isPlaying = true;
                playbackHead.style.display = "unset";
                animationFrameRef = requestAnimationFrame(onAnimationFrame);
            }
        }

        const onStop = () => {
            isPlaying = false;
            playbackHead.style.display = "none";
            if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        }

        const onAnimationFrame = () => {
            const position = playbackHeadPosition + tickDistance * (Date.now() - lastTime) / tickTime;
            playbackHead.setAttribute("transform", `translate(${position}, ${0})`);

            if (isPlaying) animationFrameRef = requestAnimationFrame(onAnimationFrame);
        }

        addTickListener(onTick);
        addPlaybackStopListener(onStop);

        return () => {
            removeTickListener(onTick);
            removePlaybackStopListener(onStop);
            if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        }
    }, [song])

    const handlePlaybackHeadRef = (ref: SVGGElement) => {
        if (ref) playbackHead = ref;
    }

    const totalWidth = workspaceWidth(song)

    const rows: JSX.Element[] = [];
    for (let i = 0; i < 5; i++) {
        rows.push(
            <line
                key={i}
                className="music-staff-row"
                x1={0}
                y1={rowY(i * 2 + 2)}
                x2={totalWidth}
                y2={rowY(i * 2 + 2)} />
        )
    }

    const beats: JSX.Element[] = [];
    for (let i = 0; i < song.measures * song.beatsPerMeasure; i++) {
        beats.push(
            <g key={i}>
                {i % song.beatsPerMeasure === 0 &&
                    <text
                        x={beatToX(i)}
                        y={STAFF_HEADER_HEIGHT - STAFF_HEADER_OFFSET}
                        textAnchor="middle"
                        fontSize={STAFF_HEADER_FONT_SIZE}>
                        {Math.floor(i / song.beatsPerMeasure) + 1}
                    </text>
                }
                <line
                    className={classList("music-staff-beat", i % song.beatsPerMeasure === 0 && "measure-start")}
                    x1={beatToX(i)}
                    y1={STAFF_HEADER_HEIGHT}
                    x2={beatToX(i)}
                    y2={WORKSPACE_HEIGHT} />
            </g>
        )
    }

    return <g className="music-staff">
        <rect
            className="music-staff-background"
            x={0}
            y={STAFF_HEADER_HEIGHT}
            width={totalWidth}
            height={WORKSPACE_HEIGHT - STAFF_HEADER_HEIGHT}
            />
        <image
            className="music-staff-clef"
            href="/static/music-editor/treble-clef.svg"
            height={CLEF_HEIGHT}
            y={STAFF_HEADER_HEIGHT}  />
        <g className="music-staff-rows">
            { rows }
        </g>
        <g className="music-staff-beats">
             {beats }
        </g>
        <g className="music-playback-head" ref={handlePlaybackHeadRef}>
            <line
                className="music-playback-line"
                x1={0}
                y1={STAFF_HEADER_HEIGHT}
                x2={0}
                y2={WORKSPACE_HEIGHT} />
        </g>
    </g>
}