namespace pxt.tutorial {
    export enum TutorialCodeStatus {
        Unknown = 0,
        Valid = 1
    }

    export function validate(step: TutorialStepInfo, source: string): TutorialCodeStatus {
        return TutorialCodeStatus.Unknown;
    }
}
