export function soundToCodalSound(sound: pxt.assets.Sound): pxsim.codal.music.Sound {
    const codalSound = new pxsim.codal.music.Sound();
    codalSound.frequency = sound.startFrequency;
    codalSound.volume = sound.startVolume;
    codalSound.endFrequency = sound.endFrequency;
    codalSound.endVolume = sound.endVolume;

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
            codalSound.fxnSteps = 512;
            codalSound.fxParam = 2;
            break;
        case "tremolo":
            codalSound.fx = pxsim.codal.music.Effect.Tremolo;
            codalSound.fxnSteps = 900;
            codalSound.fxParam = 3;
            break;
        case "warble":
            codalSound.fx = pxsim.codal.music.Effect.Warble;
            codalSound.fxnSteps = 700;
            codalSound.fxParam = 2;
            break;
    }

    codalSound.duration = sound.duration
    codalSound.steps = 90;

    return codalSound;
}