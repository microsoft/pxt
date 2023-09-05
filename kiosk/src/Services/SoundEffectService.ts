import { Howl } from "howler";
import configData from "../config.json";

export type SoundEffect = "swipe" | "switch" | "select" | "notification";

class SoundEffectService {
    private sounds: { [key: string]: Howl };
    private volume: number = configData.SoundEffectsVolume;

    constructor() {
        this.sounds = {
            swipe: new Howl({
                src: ["/kiosk-data/sfx/swipe.ogg"],
                autoplay: false,
                preload: true,
                loop: false,
            }),
            switch: new Howl({
                src: ["/kiosk-data/sfx/switch.ogg"],
                autoplay: false,
                preload: true,
                loop: false,
            }),
            select: new Howl({
                src: ["/kiosk-data/sfx/select.ogg"],
                autoplay: false,
                preload: true,
                loop: false,
            }),
            notification: new Howl({
                src: ["/kiosk-data/sfx/notification.ogg"],
                autoplay: false,
                preload: true,
                loop: false,
            }),
        };
    }

    public play(effect: SoundEffect) {
        this.playSound(this.sounds[effect]);
    }

    public playSound(sound: Howl) {
        if (!sound) return;
        if (sound.playing()) return;
        sound.volume(Math.max(0, Math.min(1, this.volume)));
        sound.play();
    }

    public setVolume(volume: number) {
        this.volume = volume;
    }
}

const soundEffectService = new SoundEffectService();

export function playSoundEffect(effect: SoundEffect) {
    soundEffectService?.play(effect);
}

export function setSoundEffectVolume(volume: number) {
    soundEffectService?.setVolume(volume);
}
