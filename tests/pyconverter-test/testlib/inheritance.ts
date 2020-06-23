
export interface BackgroundEffect {
    startScreenEffect(): void;
}

export class ScreenEffect implements BackgroundEffect {
    startScreenEffect(duration?: number, particlesPerSecond?: number): void {
    }
}

namespace game {
    export function over(win: boolean = false, effect?: BackgroundEffect): void {

    }
}

namespace effects {
    export const confetti = new ScreenEffect();
}