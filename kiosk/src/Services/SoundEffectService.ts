import { Howl } from "howler";
import configData from "../config.json";

export type SoundEffect = "swipe" | "switch" | "select" | "notification";

type Sound = {
    howl: Howl;
    name: string;
};

class SoundEffectService {
    private sounds: { [key: string]: Sound };
    private volume: number = configData.SoundEffectsVolume;

    constructor() {
        this.sounds = {
            swipe: {
                name: "swipe",
                howl: new Howl({
                    src: ["/kiosk-data/sfx/swipe.ogg"],
                    autoplay: false,
                    preload: true,
                    loop: false,
                }),
            },
            switch: {
                name: "switch",
                howl: new Howl({
                    src: ["/kiosk-data/sfx/switch.ogg"],
                    autoplay: false,
                    preload: true,
                    loop: false,
                }),
            },
            select: {
                name: "select",
                howl: new Howl({
                    src: ["/kiosk-data/sfx/select.ogg"],
                    autoplay: false,
                    preload: true,
                    loop: false,
                }),
            },
            notification: {
                name: "notification",
                howl: new Howl({
                    src: ["/kiosk-data/sfx/notification.ogg"],
                    autoplay: false,
                    preload: true,
                    loop: false,
                }),
            },
        };
    }

    public play(effect: SoundEffect) {
        switch (effect) {
            case "swipe":
                this.playSound(this.sounds.swipe);
                break;

            case "switch":
                this.playSound(this.sounds.switch);
                break;

            case "select":
                this.playSound(this.sounds.select);
                break;

            case "notification":
                this.playSound(this.sounds.notification);
                break;
        }
    }

    public playSound(sound: Sound) {
        if (!sound) return;
        if (sound.howl.playing()) return;
        //console.log(`Playing sound ${sound.name} at ${Date.now()}`);
        sound.howl.volume(Math.max(0, Math.min(1, this.volume)));
        sound.howl.play();
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
