const sounds: pxt.Map<AudioBuffer> = {};
const volume = 0.2;

export function tutorialStepNew() { playSound('jing'); }
export function tutorialStepFinished() { playSound('jing'); }
export function tutorialStart() { playSound('dong'); }

function playSound(id: string) {
    if (pxt.options.light) return;


}