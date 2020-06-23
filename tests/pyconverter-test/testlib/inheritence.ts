
export interface BackgroundEffect {
    startScreenEffect(): void;
}

export class ScreenEffect implements BackgroundEffect {
    startScreenEffect(duration?: number, particlesPerSecond?: number): void {
    }
}

export function gameOver(win: boolean = false, effect?: BackgroundEffect): void {

}

export namespace effects {
    export const confetti = new ScreenEffect();
}