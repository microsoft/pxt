namespace pxtmelody {
    export class InterpolationInfo {
        //will be the wave shape name 
        name: string;
        type: string;

        constructor(name: string, type: string) {
            this.name = name;
            this.type = type;
        }
    }

    export const SampleInterpolations = [
        new InterpolationInfo(lf("Linear"), "interpolation"),
        new InterpolationInfo(lf("Curve"), "interpolation"),
        new InterpolationInfo(lf("Vibrato"), "interpolation")
    ]
}
