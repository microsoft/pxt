const enum Interpolation {
    Linear = 0,
    Logarithmic = 1,
    Exponential = 2
}

function interpolationValue(interpolation: Interpolation, value: number): number {
    switch (interpolation) {
        case Interpolation.Linear:
            return linearInterpolation(value);
        case Interpolation.Logarithmic:
            return logarithmicInterpolation(value);
        case Interpolation.Exponential:
            return exponentialInterpolation(value);
        default:
            throw new Error("Unknown interpolation type");
    }
}

function interpolationFunction(interpolation: Interpolation): (value: number) => number {
    switch (interpolation) {
        case Interpolation.Linear:
            return linearInterpolation;
        case Interpolation.Logarithmic:
            return logarithmicInterpolation;
        case Interpolation.Exponential:
            return exponentialInterpolation;
        default:
            throw new Error("Unknown interpolation type");
    }
}


function linearInterpolation(value: number): number {
    return value;
}

function exponentialInterpolation(value: number): number {
    return 1 - Math.log(1 + (1 - value) * 1.718281828459045);
}

function logarithmicInterpolation(value: number): number {
    return Math.log(1 + value * 1.718281828459045);
}