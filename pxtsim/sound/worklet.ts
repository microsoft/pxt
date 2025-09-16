namespace pxsim {
    const source = `
    const SW_TRIANGLE = 1;
    const SW_SAWTOOTH = 2;
    const SW_SINE = 3;
    const SW_TUNEDNOISE = 4;
    const SW_NOISE = 5;
    const SW_WAVETABLE = 6;
    const SW_SQUARE_10 = 11;
    const SW_SQUARE_50 = 15;
    const SW_SQUARE_CYCLE_16 = 16;
    const SW_SQUARE_CYCLE_32 = 17;
    const SW_SQUARE_CYCLE_64 = 18;
    const OUTPUT_BITS = 14;

    let wavetable = [0];

    function instrSoundWave(instructions, index) {
        return instructions[index];
    }

    function instrFrequency(instructions, index) {
        return Math.min(20000, Math.max(20, readInt16(instructions, index + 2)));
    }

    function instrDuration(instructions, index) {
        return Math.min(60000, Math.max(1, readInt16(instructions, index + 4)));
    }

    function instrStartVolume(instructions, index) {
        return Math.min(1023, Math.max(0, readInt16(instructions, index + 6)));
    }

    function instrEndVolume(instructions, index) {
        return Math.min(1023, Math.max(0, readInt16(instructions, index + 8)));
    }

    function instrEndFrequency(instructions, index) {
        return Math.min(20000, Math.max(20, readInt16(instructions, index + 10)));
    }

    function readInt16(instructions, index) {
        return instructions[index] | (instructions[index + 1] << 8);
    }

    let x = 0xf01ba80;
    function noiseTone(sound, position, cycle) {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return (x & 0xffff) - 0x7fff;
    }

    function sineTone(sound, position, cycle) {
        let p = position;
        if (p >= 512) {
            p -= 512;
        }
        if (p > 256) {
            p = 512 - p;
        }
        // Approximate sin(x * pi / 2) with the odd polynomial y = cx^5 + bx^3 + ax
        // using the constraint y(1) = 1 => a = 1 - b - c
        //   => y = c x^5 + b x^3 + (1 - b - c) * x
        //
        // Do a least-squares fit of this to sin(x * pi / 2) in the range 0..1
        // inclusive, using 21 evenly spaced points. Resulting approximation:
        //
        // sin(x*pi/2) ~= 0.0721435357258*x**5 - 0.642443736562*x**3 + 1.57030020084*x
        // Scale the constants by 32767 to match the desired output range.
        const c = 0.0721435357258 * 32767;
        const b = -0.642443736562 * 32767;
        const a = 1.57030020084 * 32767;
        // Calculate using y = ((c * x^2 + b) * x^2 + a) * x
        //
        // The position p is x * 256, so after each multiply with p we need to
        // shift right by 8 bits to keep the decimal point in the same place.  (The
        // approximation has a negative error near x=1 which helps avoid overflow.)
        const p2 = p * p;
        const u = (c * p2 >> 16) + b;
        const v = (u * p2 >> 16) + a;
        const w = v * p >> 8;
        // The result is within 7/32767 or 0.02%, signal-to-error ratio about 38 dB.
        return position >= 512 ? -w : w;
    }

    function sawtoothTone(sound, position, cycle) {
        return (position << 6) - 0x7fff;
    }

    function triangleTone(sound, position, cycle) {
        return position < 512 ? (position << 7) - 0x7fff : ((1023 - position) << 7) - 0x7fff;
    }

    function squareWaveTone(sound, position, cycle) {
        const wave = instrSoundWave(sound.instructions, sound.currInstr);
        return position < (102 * (wave - SW_SQUARE_10 + 1)) ? -0x7fff : 0x7fff;
    }

    let tunedSeed = 0xf01ba80;
    function tunedNoiseTone(sound, position, cycle) {
        // Generate a square wave filtered by a random bit sequence. Since the generator
        // is called multiple times per wave, use PlayingSound state data to ensure we
        // only generate a random bit once per wave, and then reuse it for future
        // calls for that wave.
        //
        // Use the low 6 bits of generatorState to store the last-used cycle, and
        // random_bit to store the last on/off state. (random_bit is arbitrary as
        // long as it isn't one of the low 6 bits.)
        const random_bit = 0x8000;
        const prev_cycle = sound.generatorState & 0x3f;
        let is_on;
        if (cycle == prev_cycle) {
            is_on = sound.generatorState & random_bit;
        }
        else {
            // see https://en.wikipedia.org/wiki/Xorshift
            tunedSeed ^= tunedSeed << 13;
            tunedSeed ^= tunedSeed >> 17;
            tunedSeed ^= tunedSeed << 5;
            is_on = (tunedSeed & random_bit);
            sound.generatorState = (cycle & 0x3f) | is_on;
        }
        if (!is_on)
            return 0;
        return position < 512 ? -0x7fff : 0x7fff;
    }

    function wavetableTone(sound, position, cycle) {
        const index = (((position / 1024) * wavetable.length) | 0) % wavetable.length;
        return wavetable[index];
    }

    // Bit patterns for use by the cyclic noise tone.
    //
    // The bit pattern is arbitrary, but should have equal numbers of 0 and 1 bits,
    // and should avoid long identical-bit runs for the lower parts. The values below
    // were chosen based on a random permutation of the hex nibbles 0..f and then
    // hand-tweaked by swapping some nibbles. Generated by:
    //
    //   shuf -i 0-15 | perl -ne 's/(\d+)/printf("%x",$1)/e'
    const cycle_bits = [0x2df0eb47, 0xc8165a93];
    const cycle_mask = [0xf, 0x1f, 0x3f];

    function cycleNoiseTone(sound, position, cycle) {
        // Generate a square wave filtered by a short-cycle pseudorandom bit sequence.
        // The bit sequence repeats every 16/32/64 waves.
        //
        // The "cycle" argument corresponds to the sequential number of the generated
        // wave. This is currently a 6-bit value. Since the pseudorandom bit sequences
        // evenly fit into this, there's no need to track generator state.
        const wave = instrSoundWave(sound.instructions, sound.currInstr);
        const cycle_index = wave - SW_SQUARE_CYCLE_16;
        // CLAMP(0, cycle_index, sizeof cycle_bits / sizeof cycle_bits[0])
        cycle &= cycle_mask[cycle_index];
        const is_on = (cycle_bits[cycle >> 5] & (1 << (cycle & 0x1f)));
        if (!is_on)
            return 0;
        return position < 512 ? -0x7fff : 0x7fff;
    }

    function silenceTone(sound, position, cycle) {
        return 0;
    }

    function getWaveFn(wave) {
        switch (wave) {
            case SW_TRIANGLE:
                return triangleTone;
            case SW_SAWTOOTH:
                return sawtoothTone;
            case SW_TUNEDNOISE:
                return tunedNoiseTone;
            case SW_NOISE:
                return noiseTone;
            case SW_SINE:
                return sineTone;
            case SW_WAVETABLE:
                return wavetableTone;
            default:
                if (SW_SQUARE_10 <= wave && wave <= SW_SQUARE_50)
                    return squareWaveTone;
                if (SW_SQUARE_CYCLE_16 <= wave && wave <= SW_SQUARE_CYCLE_64)
                    return cycleNoiseTone;
                else
                    return silenceTone;
        }
    }

    function fillSamples(dst, numsamples, sounds, sampleRate) {
        const samplesPerMS = (sampleRate << 8) / 1000;
        const toneStepMult = (1024.0 * (1 << 16)) / sampleRate;
        let fn;

        for (const snd of sounds) {
            let toneStep = 0;
            let toneDelta = 0;
            let volumeStep = 0;
            let tonePosition = snd.tonePosition;
            let samplesLeft = 0;
            let wave = 0;
            let volume = 0;

            snd.currInstr -= 12;

            for (let j = 0; j < numsamples; ++j) {
                if (samplesLeft == 0) {
                    snd.currInstr += 12;
                    if (snd.currInstr >= snd.instructions.length) {
                        break;
                    }
                    // SoundInstruction copy = *snd.currInstr;
                    // instr = &copy;

                    wave = instrSoundWave(snd.instructions, snd.currInstr);
                    fn = getWaveFn(wave);
                    samplesLeft = (instrDuration(snd.instructions, snd.currInstr) * samplesPerMS >> 8);
                    // make sure the division is signed
                    volumeStep = Math.floor(((instrEndVolume(snd.instructions, snd.currInstr) - instrStartVolume(snd.instructions, snd.currInstr)) << 16) / samplesLeft);
                    if (j == 0 && snd.prevVolume != -1) {
                        // restore previous state
                        samplesLeft = snd.samplesLeftInCurr;
                        volume = snd.prevVolume;
                        toneStep = snd.prevToneStep;
                        toneDelta = snd.prevToneDelta;
                    }
                    else {
                        // LOG("#sampl %d %p", samplesLeft, snd.currInstr);
                        volume = instrStartVolume(snd.instructions, snd.currInstr) << 16;
                        // LOG("%d-%dHz %d-%d vol", instr.frequency, instr.endFrequency,
                        //     instr.startVolume, instr.endVolume);
                        toneStep = Math.floor(toneStepMult * instrFrequency(snd.instructions, snd.currInstr));
                        if (instrFrequency(snd.instructions, snd.currInstr) != instrEndFrequency(snd.instructions, snd.currInstr)) {
                            const endToneStep = (toneStepMult * instrEndFrequency(snd.instructions, snd.currInstr)) | 0;
                            toneDelta = ((endToneStep - toneStep) / samplesLeft) | 0;
                        }
                        else {
                            toneDelta = 0;
                        }
                    }
                }
                let v = fn(snd, (tonePosition >> 16) & 1023, tonePosition >> 26);
                v = (v * (volume >> 16)) >> (10 + (16 - OUTPUT_BITS));
                // if (v > MAXVAL)
                //    target_panic(123);
                for (const output of dst) {
                    for (const channel of output) {
                        channel[j] = channel[j] + (v / 0xffff);
                    }
                }
                // console.log("v", v);
                tonePosition += toneStep;
                toneStep += toneDelta;
                volume += volumeStep;
                samplesLeft--;
            }

            if (snd.currInstr >= snd.instructions.length) {
                // snd.sound.state = SoundState::Done;
                // snd.sound = NULL;
            }
            else {
                snd.tonePosition = tonePosition;
                if (samplesLeft == 0)
                    samplesLeft++; // avoid infinite loop in next iteration
                snd.samplesLeftInCurr = samplesLeft;
                snd.prevVolume = volume;
                snd.prevToneDelta = toneDelta;
                snd.prevToneStep = toneStep;
            }
        }
    }

    class MixerAudioWorkletProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.sounds = [];
            this.port.onmessage = event => {
                if (event.data.type === "play") {
                    this.sounds.push({
                        startSampleNo: 0,
                        samplesLeftInCurr: 0,
                        tonePosition: 0,
                        prevVolume: -1,
                        prevToneStep: 0,
                        prevToneDelta: 0,
                        generatorState: 0,
                        instructions: event.data.instructions,
                        currInstr: 0,
                        id: event.data.id
                    });
                }
                else if (event.data.type === "cancel") {
                    this.sounds = this.sounds.filter(s => s.id !== event.data.id);
                }
                else if (event.data.type === "wavetable") {
                    wavetable = event.data.wavetable;;
                }
            };
        }

        process(inputs, outputs, parameters) {
            if (this.sounds.length) {
                fillSamples(outputs, outputs[0][0].length, this.sounds, sampleRate);

                for (const sound of this.sounds) {
                    if (sound.currInstr >= sound.instructions.length) {
                        this.port.postMessage({ type: "done", id: sound.id });
                    }
                }
                this.sounds = this.sounds.filter(s => s.currInstr < s.instructions.length);
            }
            return true;
        }
    }
    registerProcessor("pxt-mixer-audio-worklet-processor", MixerAudioWorkletProcessor);
    `;

    export function getWorkletUri() {
        const b = new Blob([source], { type: "text/javascript" })
        return URL.createObjectURL(b);
    }

}