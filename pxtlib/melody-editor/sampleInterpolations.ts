namespace pxtmelody {
    export class InterpolationInfo {
        //will be the wave shape name 
        name: string;
        type: string;
        image: string;

        constructor(name: string, type: string, image: string) {
            this.name = name;
            this.type = type;
            this.image = image;
        }
    }

    export const SampleInterpolations = [
        new InterpolationInfo(lf("linear"), "interpolation", "/static/online-learning/img/interpolations/linear.png"),
        new InterpolationInfo(lf("quadratic"), "interpolation", "/static/online-learning/img/interpolations/quadratic.png"),
        new InterpolationInfo(lf("exponential"), "interpolation", "/static/online-learning/img/interpolations/exponential.png")
    ]
}
