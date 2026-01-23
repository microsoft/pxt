import { SoundGalleryItem } from "./SoundGallery";

export function soundToCodalSound(sound: pxt.assets.Sound): pxsim.codal.music.Sound {
    const codalSound = new pxsim.codal.music.Sound();
    codalSound.frequency = sound.startFrequency;
    codalSound.volume = (sound.startVolume / pxt.assets.MAX_VOLUME) * 1023 | 0;
    codalSound.endFrequency = sound.endFrequency;
    codalSound.endVolume = (sound.endVolume / pxt.assets.MAX_VOLUME) * 1023 | 0;

    switch (sound.wave) {
        case "sine": codalSound.wave = pxsim.codal.music.WaveShape.Sine; break;
        case "triangle": codalSound.wave = pxsim.codal.music.WaveShape.Triangle; break;
        case "square": codalSound.wave = pxsim.codal.music.WaveShape.Square; break;
        case "sawtooth": codalSound.wave = pxsim.codal.music.WaveShape.Sawtooth; break;
        case "noise": codalSound.wave = pxsim.codal.music.WaveShape.Noise; break;
    }

    switch (sound.interpolation) {
        case "linear": codalSound.shape = pxsim.codal.music.InterpolationEffect.Linear; break;
        case "curve": codalSound.shape = pxsim.codal.music.InterpolationEffect.Curve;  break;
        case "logarithmic": codalSound.shape = pxsim.codal.music.InterpolationEffect.Logarithmic;  break;
    }

    // These values were chosen through trial and error to get something
    // that sounded pleasing and is most like the intended effect
    switch (sound.effect) {
        case "vibrato":
            codalSound.fx = pxsim.codal.music.Effect.Vibrato;
            codalSound.fxnSteps = readDalConstant("SFX_DEFAULT_VIBRATO_STEPS", 512);
            codalSound.fxParam = readDalConstant("SFX_DEFAULT_VIBRATO_PARAM", 2);
            break;
        case "tremolo":
            codalSound.fx = pxsim.codal.music.Effect.Tremolo;
            codalSound.fxnSteps = readDalConstant("SFX_DEFAULT_TREMOLO_STEPS", 900);
            codalSound.fxParam = readDalConstant("SFX_DEFAULT_TREMOLO_PARAM", 3);
            break;
        case "warble":
            codalSound.fx = pxsim.codal.music.Effect.Warble;
            codalSound.fxnSteps = readDalConstant("SFX_DEFAULT_WARBLE_STEPS", 700);
            codalSound.fxParam = readDalConstant("SFX_DEFAULT_WARBLE_PARAM", 2);
            break;
    }

    codalSound.duration = Math.max(Math.min(sound.duration | 0, 9999), 1)
    codalSound.steps = 90;

    return codalSound;
}

export function getGallerySounds(useMixerSynthesizer: boolean): SoundGalleryItem[] {
    if (useMixerSynthesizer) {
        return getMixerGallerySounds();
    }
    else {
        return getCODALGallerySounds();
    }

}
export function getCODALGallerySounds(): SoundGalleryItem[] {
    const res: SoundGalleryItem[] = [
        {
            name: pxt.U.lf("Laser"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 1600,
                endFrequency: 1,
                duration: 300
            }
        },
        {
            name: pxt.U.lf("Radio"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 500,
                endFrequency: 499,
                duration: 750
            }
        },
        {
            name: pxt.U.lf("Jump"),
            sound: {
                interpolation: "linear",
                effect: "warble",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 400,
                endFrequency: 600,
                duration: 100
            }
        },
        {
            name: pxt.U.lf("Water Drop"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "sine",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 200,
                endFrequency: 600,
                duration: 150
            }
        },
        {
            name: pxt.U.lf("Kick Drum"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 200,
                endFrequency: 1,
                duration: 100
            }
        },
        {
            name: pxt.U.lf("Tom"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "triangle",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 300,
                endFrequency: 200,
                duration: 75
            }
        },
        {
            name: pxt.U.lf("Snare"),
            sound: {
                interpolation: "logarithmic",
                effect: "warble",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 523,
                endFrequency: 1,
                duration: 100
            }
        },
        {
            name: pxt.U.lf("Hi-Hat"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 500,
                endFrequency: 1,
                duration: 10
            }
        },
        {
            name: pxt.U.lf("Cowbell"),
            sound: {
                interpolation: "linear",
                effect: "vibrato",
                wave: "sine",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 500,
                endFrequency: 500,
                duration: 50
            }
        },
        {
            name: pxt.U.lf("Triangle"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 54,
                endFrequency: 54,
                duration: 500
            }
        }
    ];

    return res;
}

export function getMixerGallerySounds(): SoundGalleryItem[] {
    const res: SoundGalleryItem[] = [
        {
            name: pxt.U.lf("Laser"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 1600,
                endFrequency: 1,
                duration: 300
            }
        },
        {
            name: pxt.U.lf("Jump"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 400,
                endFrequency: 600,
                duration: 100
            }
        },
        {
            name: pxt.U.lf("Water Drop"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "sine",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 200,
                endFrequency: 600,
                duration: 150
            }
        },
        {
            name: pxt.U.lf("Kick Drum"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "square",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 200,
                endFrequency: 1,
                duration: 100
            }
        },
        {
            name: pxt.U.lf("Tom"),
            sound: {
                interpolation: "curve",
                effect: "none",
                wave: "triangle",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 300,
                endFrequency: 200,
                duration: 75
            }
        },
        {
            name: pxt.U.lf("Snare"),
            sound: {
                interpolation: "linear",
                effect: "warble",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 3300,
                endFrequency: 1400,
                duration: 150
            }
        },
        {
            name: pxt.U.lf("Hi-Hat"),
            sound: {
                interpolation: "linear",
                effect: "none",
                wave: "noise",
                startVolume: pxt.assets.MAX_VOLUME,
                endVolume: 0,
                startFrequency: 3900,
                endFrequency: 3500,
                duration: 10
            }
        }
    ];

    return res;
}

function readDalConstant(name: string, defaultValue: number) {
    const file = pxt.appTarget.bundledpkgs?.["core"]?.["dal.d.ts"];

    if (!file) return defaultValue;

    const regEx = new RegExp(`${name}\\s*=\\s*(\\d+),`);

    const match = regEx.exec(file);

    if (match) {
        return parseInt(match[1]);
    }
    return defaultValue;
}