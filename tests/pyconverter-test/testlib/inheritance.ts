namespace effects {
    export interface BackgroundEffect {
        startScreenEffect(): void;
    }

    export class ScreenEffect implements BackgroundEffect {
        startScreenEffect(duration?: number, particlesPerSecond?: number): void {
        }
    }

    export const confetti = new ScreenEffect();
}

namespace game {
    export function over(win: boolean = false, effect?: effects.BackgroundEffect): void {

    }
}