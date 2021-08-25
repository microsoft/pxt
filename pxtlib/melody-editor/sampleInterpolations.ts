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
        new InterpolationInfo(lf("linear"), "interpolation"),
        new InterpolationInfo(lf("curve"), "interpolation"),
        new InterpolationInfo(lf("vibrato"), "interpolation")
    ]
}
