enum Notes {
    //% enumval=262
    C,
    //% enumval=277
    CSharp_,
    //% enumval=294
    D,
    //% enumval=311
    Eb,
    //% enumval=330
    E,
    //% enumval=349
    F,
    //% enumval=370
    FSharp_,
    //% enumval=392
    G,
    //% enumval=415
    GSharp_,
    //% enumval=440
    A,
    //% enumval=466
    Bb,
    //% enumval=494
    B,
    //% enumval=131
    C3,
    //% enumval=139
    CSharp_3,
    //% enumval=147
    D3,
    //% enumval=156
    Eb3,
    //% enumval=165
    E3,
    //% enumval=175
    F3,
    //% enumval=185
    FSharp_3,
    //% enumval=196
    G3,
    //% enumval=208
    GSharp_3,
    //% enumval=220
    A3,
    //% enumval=233
    Bb3,
    //% enumval=247
    B3,
    //% enumval=262
    C4,
    //% enumval=277
    CSharp_4,
    //% enumval=294
    D4,
    //% enumval=311
    Eb4,
    //% enumval=330
    E4,
    //% enumval=349
    F4,
    //% enumval=370
    FSharp_4,
    //% enumval=392
    G4,
    //% enumval=415
    GSharp_4,
    //% enumval=440
    A4,
    //% enumval=466
    Bb4,
    //% enumval=494
    B4,
    //% enumval=523
    C5,
    //% enumval=555
    CSharp_5,
    //% enumval=587
    D5,
    //% enumval=622
    Eb5,
    //% enumval=659
    E5,
    //% enumval=698
    F5,
    //% enumval=740
    FSharp_5,
    //% enumval=784
    G5,
    //% enumval=831
    GSharp_5,
    //% enumval=880
    A5,
    //% enumval=932
    Bb5,
    //% enumval=989
    B5,
}

namespace music {
    var beatsPerMinute: number = 120;

    /**
     * Plays a tone through pin ``P0`` for the given duration.
     * @param frequency TODO
     * @param ms TODO
     */
    //% help=functions/play-tone weight=90
    export function playTone(frequency: number, ms: number): void {
        pins.analogSetPitchPin(AnalogPins.P0);
        pins.analogPitch(frequency, ms);
    }

    /**
     * Gets the frequency of a note.
     * @param name TODO
     */
    //% shim=TD_ID async weight=40 help=functions/note-frequency
    export function noteFrequency(name: Notes): number { return name; }

    /**
     * Plays a tone through pin ``P0``.
     * @param frequency TODO
     */
    //% help=functions/ring-tone weight=80
    export function ringTone(frequency: number): void {
        pins.analogSetPitchPin(AnalogPins.P0);
        pins.analogPitch(frequency, 0);
    }

    /**
     * Rests (plays nothing) for a specified time through pin ``P0``.
     * @param ms TODO
     */
    //% help=functions/rest weight=79
    export function rest(ms: number): void {
        playTone(0, ms);
    }

    /**
     * This function is obsolete. Please use ``music->note frequency`` instead.
     * @param name TODO
     */
    //% weight=0 help=functions/note-frequency
    export function note(name: Notes): number {
        return noteFrequency(name);
    }

    /**
     * This function is obsolete. Please use ``music->play tone`` instead.
     * @param frequency TODO
     * @param ms TODO
     */
    //% help=functions/play-tone weight=0
    export function playNote(frequency: number, ms: number): void {
        playTone(frequency, ms);
    }

    /**
     * Returns the tempo in beats per minute. Tempo is the speed (bpm = beats per minute) at which notes play. The larger the tempo value, the faster the notes will play.
     */
    //% help=/functions/tempo
    export function tempo(): number {
        return beatsPerMinute;
    }

    /**
     * Change the tempo by the specified amount
     * @param bpm TODO
     */
    //% help=/functions/tempo
    export function changeTempoBy(bpm: number): void {
        setTempo(beatsPerMinute + bpm);
    }

    /**
     * Sets the tempo to the specified amount
     * @param bpm TODO
     */
    //% help=/functions/tempo
    export function setTempo(bpm: number): void {
        if (bpm > 0) {
            beatsPerMinute = Math.max(1, bpm);
        }
    }

    /**
     * Returns the duration of a beat in milli-seconds
     */
    //% help=/functions/beat weight=20
    export function beat(): number {
        let ms: number;
        return 60000 / beatsPerMinute;
    }
}
