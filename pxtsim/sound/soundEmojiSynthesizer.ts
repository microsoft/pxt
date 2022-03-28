/**
 * Adapted from lancaster-university/codal-microbit-v2
 * https://github.com/lancaster-university/codal-microbit-v2/blob/master/source/SoundEmojiSynthesizer.cpp
 */
namespace pxsim.codal.music {
    // https://github.com/lancaster-university/codal-microbit-v2/blob/master/inc/SoundEmojiSynthesizer.h#L30
    export const EMOJI_SYNTHESIZER_SAMPLE_RATE = 44100;
    export const EMOJI_SYNTHESIZER_TONE_WIDTH_F = 1024;
    export const EMOJI_SYNTHESIZER_TONE_WIDTH = 1024;
    export const EMOJI_SYNTHESIZER_BUFFER_SIZE = 512;

    export const EMOJI_SYNTHESIZER_TONE_EFFECT_PARAMETERS = 2;
    export const EMOJI_SYNTHESIZER_TONE_EFFECTS = 3;

    export const EMOJI_SYNTHESIZER_STATUS_ACTIVE = 0x1;
    export const EMOJI_SYNTHESIZER_STATUS_OUTPUT_SILENCE_AS_EMPTY = 0x2;
    export const EMOJI_SYNTHESIZER_STATUS_STOPPING = 0x4;


    export class SoundEmojiSynthesizer {
        bufferSize: number;
        buffer: number[];

        sampleRate: number;
        sampleRange: number;
        samplesPerStep: number[] = [];
        samplesToWrite: number;
        samplesWritten: number;

        orMask: number;
        frequency: number;
        volume: number;

        position: number;
        status = 0;


        effectPointer = 0;
        effectBuffer: SoundEffect[];

        get effect() {
            return this.effectBuffer[this.effectPointer];
        }

        constructor(id: number, sampleRate = EMOJI_SYNTHESIZER_SAMPLE_RATE) {
            this.position = 0;
            this.bufferSize = EMOJI_SYNTHESIZER_BUFFER_SIZE;
            this.sampleRate = sampleRate;
            this.samplesToWrite = 0;
            this.samplesWritten = 0;
            this.sampleRange = 1023;
            this.orMask = 0;
            this.effectPointer = -1;
            this.volume = 1;
        }

        play(sound: SoundEffect[]) {
            this.effectBuffer = sound;
            this.effectPointer = -1;

            this.nextSoundEffect();
        }

        nextSoundEffect() {
            const hadEffect = this.effect != null;
            if (this.status & EMOJI_SYNTHESIZER_STATUS_STOPPING) {
                this.effectPointer = null;
                this.effectBuffer = [];
            }

            // If a sequence of SoundEffects are being played, attempt to move on to the next.
            // If not, select the first in the buffer.
            if (this.effect)
                this.effectPointer++;
            else
                this.effectPointer = 0;

            // Validate that we have a valid sound effect. If not, record that we have nothing to play.
            if (this.effectPointer >= this.effectBuffer.length) {
                // if we have an effect with a negative duration, reset the buffer (unless there is an update pending)
                this.effectPointer = 0;

                if (this.effect.duration >= 0) {
                    this.effectPointer = -1;
                    this.effectBuffer = [];
                    this.samplesWritten = 0;
                    this.samplesToWrite = 0;
                    this.position = 0;
                    return hadEffect;
                }
            }

            // We have a valid buffer. Set up our synthesizer to the requested parameters.
            this.samplesToWrite = this.determineSampleCount(this.effect.duration);
            this.frequency = this.effect.frequency;
            this.volume = this.effect.volume;
            this.samplesWritten = 0;

            // validate and initialise per effect rendering state.
            for (let i = 0; i < EMOJI_SYNTHESIZER_TONE_EFFECTS; i++) {
                this.effect.effects[i].step = 0;
                this.effect.effects[i].steps = Math.max(this.effect.effects[i].steps, 1);
                this.samplesPerStep[i] = Math.floor(this.samplesToWrite / this.effect.effects[i].steps);
            }
            return false;
        }

        pull(): number[] {
            let done = false;
            let sample: number;
            let bufferEnd: number;

            while (!done) {
                if (this.samplesWritten == this.samplesToWrite || this.status & EMOJI_SYNTHESIZER_STATUS_STOPPING) {
                    let renderComplete = this.nextSoundEffect();

                    // If we have just completed active playout of an effect, and there are no more effects scheduled,
                    // unblock any fibers that may be waiting to play a sound effect.
                    if (this.samplesToWrite == 0 || this.status & EMOJI_SYNTHESIZER_STATUS_STOPPING) {
                        done = true;
                        if (renderComplete || this.status & EMOJI_SYNTHESIZER_STATUS_STOPPING) {
                            this.status &= ~EMOJI_SYNTHESIZER_STATUS_STOPPING;

                            // Event(id, DEVICE_SOUND_EMOJI_SYNTHESIZER_EVT_DONE);
                            // lock.notify();
                        }
                    }
                }

                // If we have something to do, ensure our buffers are created.
                // We defer creation to avoid unnecessary heap allocation when generating silence.
                if (((this.samplesWritten < this.samplesToWrite) || !(this.status & EMOJI_SYNTHESIZER_STATUS_OUTPUT_SILENCE_AS_EMPTY)) && sample == null) {
                    this.buffer = new Array(this.bufferSize);
                    sample = 0;
                    bufferEnd = this.buffer.length;
                }

                // Generate some samples with the current this.effect parameters.
                while (this.samplesWritten < this.samplesToWrite) {
                    let skip = ((EMOJI_SYNTHESIZER_TONE_WIDTH_F * this.frequency) / this.sampleRate);
                    let gain = (this.sampleRange * this.volume) / 1024;
                    let offset = 512 - (512 * gain);

                    let effectStepEnd: number[] = [];

                    for (let i = 0; i < EMOJI_SYNTHESIZER_TONE_EFFECTS; i++) {
                        effectStepEnd[i] = (this.samplesPerStep[i] * (this.effect.effects[i].step));
                        if (this.effect.effects[i].step == this.effect.effects[i].steps - 1)
                            effectStepEnd[i] = this.samplesToWrite;
                    }

                    let stepEndPosition = effectStepEnd[0];
                    for (let i = 1; i < EMOJI_SYNTHESIZER_TONE_EFFECTS; i++)
                        stepEndPosition = Math.min(stepEndPosition, effectStepEnd[i]);

                    // Write samples until the end of the next this.effect-step
                    while (this.samplesWritten < stepEndPosition) {
                        // Stop processing when we've filled the requested this.buffer
                        if (sample == bufferEnd) {
                            // downStream.pullRequest();
                            return this.buffer;
                        }

                        // Synthesize a sample
                        let s = this.effect.tone.tonePrint(this.effect.tone.parameter, this.position);

                        // Apply volume scaling and OR mask (if specified).
                        this.buffer[sample] = (((s * gain) + offset)) // | this.orMask;

                        // Move on our pointers.
                        sample++;
                        this.samplesWritten++;
                        this.position += skip;

                        // Keep our toneprint pointer in range
                        while (this.position > EMOJI_SYNTHESIZER_TONE_WIDTH_F)
                            this.position -= EMOJI_SYNTHESIZER_TONE_WIDTH_F;
                    }

                    // Invoke the this.effect function for any effects that are due.
                    for (let i = 0; i < EMOJI_SYNTHESIZER_TONE_EFFECTS; i++) {
                        if (this.samplesWritten == effectStepEnd[i]) {
                            if (this.effect.effects[i].step < this.effect.effects[i].steps) {
                                if (this.effect.effects[i].effect)
                                    this.effect.effects[i].effect(this, this.effect.effects[i]);

                                this.effect.effects[i].step++;
                            }
                        }
                    }
                }
            }

            // if we have no data to send, return an empty this.buffer (if requested)
            if (sample == null) {
                this.buffer = [];
            }
            else {
                // Pad the output this.buffer with silence if necessary.
                const silence = (this.sampleRange * 0.5) // | this.orMask;
                while (sample < bufferEnd) {
                    this.buffer[sample] = silence;
                    sample++;
                }
            }

            // Issue a Pull Request so that we are always receiver driven, and we're done.
            // downStream.pullRequest();
            return this.buffer;
        }

        determineSampleCount(playoutTime: number) {
            if (playoutTime < 0)
                playoutTime = -playoutTime;

            const seconds = playoutTime / 1000;
            return Math.floor(this.sampleRate * seconds);
        }

        totalDuration() {
            let duration = 0;

            for (const effect of this.effectBuffer) duration += effect.duration

            return duration;
        }
    }
}
