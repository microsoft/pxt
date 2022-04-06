/**
 * Adapted from lancaster-university/codal-microbit-v2
 * https://github.com/lancaster-university/codal-microbit-v2/blob/master/source/SoundSynthesizerEffects.cpp
 */
namespace pxsim.codal.music.SoundSynthesizerEffects {
    /*
     * Definitions of standard progressions.
     */

    /**
     * Root Frequency Interpolation Effect Functions
     */

    export function noInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
    }

    // Linear interpolate function.
    // parameter[0]: end frequency
    export function linearInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        let interval = (context.parameter[0] - synth.effect.frequency) / context.steps;
        synth.frequency = synth.effect.frequency + interval * context.step;
    }

    // Linear interpolate function.
    // parameter[0]: end frequency
    export function logarithmicInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = synth.effect.frequency + (Math.log10(Math.max(context.step, 0.1)) * (context.parameter[0] - synth.effect.frequency) / 1.95);
    }

    // Curve interpolate function
    // parameter[0]: end frequency
    export function curveInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = (Math.sin(context.step * 3.12159 / 180.0) * (context.parameter[0] - synth.effect.frequency) + synth.effect.frequency);
    }

    // Cosine interpolate function
    // parameter[0]: end frequency
    export function slowVibratoInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = Math.sin(context.step / 10) * context.parameter[0] + synth.effect.frequency;
    }

    //warble function
    // parameter[0]: end frequency
    export function warbleInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = (Math.sin(context.step) * (context.parameter[0] - synth.effect.frequency) + synth.effect.frequency);
    }

    // Vibrato function
    // parameter[0]: end frequency
    export function vibratoInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = synth.effect.frequency + Math.sin(context.step) * context.parameter[0];
    }

    // Exponential rising function
    // parameter[0]: end frequency
    export function exponentialRisingInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = synth.effect.frequency + Math.sin(0.01745329 * context.step) * context.parameter[0];
    }

    // Exponential falling function
    export function exponentialFallingInterpolation(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = synth.effect.frequency + Math.cos(0.01745329 * context.step) * context.parameter[0];
    }

    // Argeppio functions
    export function appregrioAscending(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = MusicalProgressions.calculateFrequencyFromProgression(synth.effect.frequency, context.parameter_p[0], context.step);
    }

    export function appregrioDescending(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        synth.frequency = MusicalProgressions.calculateFrequencyFromProgression(synth.effect.frequency, context.parameter_p[0], context.steps - context.step - 1);
    }


    /**
     * Frequency Delta effects
     */

    // Frequency vibrato function
    // parameter[0]: vibrato frequency multiplier
    export function frequencyVibratoEffect(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        if (context.step == 0)
            return;

        if (context.step % 2 == 0)
            synth.frequency /= context.parameter[0];
        else
            synth.frequency *= context.parameter[0];
    }

    // Volume vibrato function
    // parameter[0]: vibrato volume multiplier
    export function volumeVibratoEffect(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        if (context.step == 0)
            return;

        if (context.step % 2 == 0)
            synth.volume /= context.parameter[0];
        else
            synth.volume *= context.parameter[0];

    }

    /**
     * Volume Delta effects
     */

    /** Simple ADSR enveleope effect.
     * parameter[0]: Centre volume
     * parameter[1]: End volume
     * effect.volume: start volume
     */
    export function adsrVolumeEffect(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        let halfSteps = context.steps * 0.5;

        if (context.step <= halfSteps) {
            let delta = (context.parameter[0] - synth.effect.volume) / halfSteps;
            synth.volume = synth.effect.volume + context.step * delta;
        } else {
            let delta = (context.parameter[1] - context.parameter[0]) / halfSteps;
            synth.volume = context.parameter[0] + (context.step - halfSteps) * delta;
        }
    }

    /**
     * Simple volume ramp effect
     * parameter[0]: End volume
     * effect.volume: start volume
     */
    export function volumeRampEffect(synth: SoundEmojiSynthesizer, context: ToneEffect) {
        let delta = (context.parameter[0] - synth.effect.volume) / context.steps;
        synth.volume = synth.effect.volume + context.step * delta;
    }

}