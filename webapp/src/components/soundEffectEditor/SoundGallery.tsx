import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList, fireClickOnEnter } from "../../../../react-common/components/util";
import { CancellationToken } from "./SoundEffectEditor";
import { soundToCodalSound } from "./soundUtil";

export interface SoundGalleryItem {
    sound: pxt.assets.Sound;
    name: string;
}

export interface SoundGalleryProps {
    onSoundSelected: (newSound: pxt.assets.Sound) => void;
    sounds: SoundGalleryItem[];
    visible: boolean;
}

export const SoundGallery = (props: SoundGalleryProps) => {
    const { sounds, onSoundSelected, visible } = props;

    return <div className={classList("sound-gallery", visible && "visible")} aria-hidden={!visible}>
        <div className="sound-gallery-scroller">
            {sounds.map((item, index) =>
                <div
                    key={index}
                    className="common-button"
                    title={item.name}
                    role="button"
                    tabIndex={0}
                    onKeyDown={fireClickOnEnter}
                    onClick={() => onSoundSelected(item.sound)}>

                    <SoundGalleryEntry {...item} />
                </div>
            )}
        </div>
    </div>
}


const SoundGalleryEntry = (props: SoundGalleryItem) => {
    const { sound, name } = props;
    const width = 160;
    const height = 40;

    const [ cancelToken, setCancelToken ] = React.useState<CancellationToken>(null);

    const handlePlayButtonClick = () => {
        if (cancelToken) {
            cancelToken.cancelled = true
            setCancelToken(null);
            return;
        }
        const newToken = {
            cancelled: false
        }
        setCancelToken(newToken);
        const codalSound = soundToCodalSound(sound);
        pxsim.codal.music.playSoundExpressionAsync(codalSound.src, () => newToken.cancelled)
            .then(() => {
                setCancelToken(null);
            });
    }

    return <div className="sound-gallery-item-label">
        <div className="sound-effect-name">
            {name}
        </div>
        <div className="sound-gallery-preview">
            <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
                <path
                    className="sound-gallery-preview-wave"
                    d={pxt.assets.renderSoundPath(sound, width, height)}
                    stroke="grey"
                    strokeWidth="2"
                    fill="none"/>
            </svg>
        </div>
        <Button
            className="sound-effect-play-button"
            title={cancelToken ? lf("Stop Sound Preview") : lf("Preview Sound")}
            onClick={handlePlayButtonClick}
            leftIcon={cancelToken ? "fas fa-stop" : "fas fa-play"}
            />
    </div>
}


