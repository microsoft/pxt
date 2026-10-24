namespace pxsim.codal.music {
    export interface Progression {
        interval: number[];
        length: number;
    }
}

namespace pxsim.codal.music.MusicalIntervals {
    // #if CONFIG_ENABLED(JUST_SCALE)
    // const float MusicalIntervals.chromaticInterval[] = [1.000000, 1.059463, 1.122462, 1.189207, 1.259921, 1.334840, 1.414214, 1.498307, 1.587401, 1.681793, 1.781797, 1.887749];
    // #else
    // const float MusicalIntervals.chromaticInterval[] = [1.000000, 1.0417, 1.1250, 1.2000, 1.2500, 1.3333, 1.4063, 1.5000, 1.6000, 1.6667, 1.8000, 1.8750];
    // #endif

    export const chromaticInterval =  [1.000000, 1.0417, 1.1250, 1.2000, 1.2500, 1.3333, 1.4063, 1.5000, 1.6000, 1.6667, 1.8000, 1.8750];


    export const majorScaleInterval = [chromaticInterval[0], chromaticInterval[2], chromaticInterval[4], chromaticInterval[5], chromaticInterval[7], chromaticInterval[9], chromaticInterval[11]];
    export const minorScaleInterval = [chromaticInterval[0], chromaticInterval[2], chromaticInterval[3], chromaticInterval[5], chromaticInterval[7], chromaticInterval[8], chromaticInterval[10]];
    export const pentatonicScaleInterval = [chromaticInterval[0], chromaticInterval[2], chromaticInterval[4], chromaticInterval[7], chromaticInterval[9]];
    export const majorTriadInterval = [chromaticInterval[0], chromaticInterval[4], chromaticInterval[7]];
    export const minorTriadInterval = [chromaticInterval[0], chromaticInterval[3], chromaticInterval[7]];
    export const diminishedInterval = [chromaticInterval[0], chromaticInterval[3], chromaticInterval[6], chromaticInterval[9]];
    export const wholeToneInterval = [chromaticInterval[0], chromaticInterval[2], chromaticInterval[4], chromaticInterval[6], chromaticInterval[8], chromaticInterval[10]];

}



namespace pxsim.codal.music.MusicalProgressions {

    export const chromatic: Progression = { interval: MusicalIntervals.chromaticInterval, length: 12 };
    export const majorScale: Progression = { interval: MusicalIntervals.majorScaleInterval, length: 7 };
    export const minorScale: Progression = { interval: MusicalIntervals.minorScaleInterval, length: 7 };
    export const pentatonicScale: Progression = { interval: MusicalIntervals.pentatonicScaleInterval, length: 5 };
    export const majorTriad: Progression = { interval: MusicalIntervals.majorTriadInterval, length: 3 };
    export const minorTriad: Progression = { interval: MusicalIntervals.minorTriadInterval, length: 3 };
    export const diminished: Progression = { interval: MusicalIntervals.diminishedInterval, length: 4 };
    export const wholeTone: Progression = { interval: MusicalIntervals.wholeToneInterval, length: 6 };



    /**
     * Determine the frequency of a given note in a given progressions
     *
     * @param root The root frequency of the progression
     * @param progression The Progression to use
     * @param offset The offset (interval) of the note to generate
     * @return The frequency of the note requested in Hz.
     */
    export function calculateFrequencyFromProgression(root: number, progression: Progression, offset: number)
    {
        let octave = Math.floor(offset / progression.length);
        let index = offset % progression.length;

        return root * Math.pow(2, octave) * progression.interval[index];
    }
}