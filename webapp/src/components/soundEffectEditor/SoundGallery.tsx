import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { soundToCodalSound } from "./soundUtil";

export interface SoundGalleryItem {
    sound: pxt.assets.Sound;
    name: string;
}

export interface SoundGalleryProps {
    onSoundSelected: (newSound: pxt.assets.Sound) => void;
    sounds: SoundGalleryItem[];
}

export const SoundGallery = (props: SoundGalleryProps) => {
    const { sounds, onSoundSelected } = props;

    return <div className="sound-gallery">
        {sounds.map((item, index) =>
            <Button
                key={index}
                title={item.name}
                label={<SoundGalleryEntry {...item} />}
                onClick={() => onSoundSelected(item.sound)}
            />
        )}
    </div>
}


const SoundGalleryEntry = (props: SoundGalleryItem) => {
    const { sound, name } = props;
    const width = 160;
    const height = 40;

    const play = () => {
        const codalSound = soundToCodalSound(sound);
        pxsim.codal.music.playSoundExpressionAsync(codalSound.src);
    }

    return <div className="sound-gallery-item-label">
        <div>
            {name}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            <path d={pxt.assets.renderSoundPath(sound, width, height)} stroke="grey" strokeWidth="2" fill="none"/>
        </svg>
        <Button
            className="sound-effect-play-button"
            title={lf("Play")}
            onClick={play}
            leftIcon="fas fa-play"
            />
    </div>
}


