import * as audio from "./audio";

const sounds: pxt.Map<AudioBuffer> = {};
const volume = 0.2;

function loadSoundAsync(id: string): Promise<AudioBuffer> {

    const path = (<any>(pxt.appTarget.appTheme.sounds) || {})[id] as string;
    if (pxt.options.light || !path) return Promise.resolve<AudioBuffer>(undefined);

    let buffer = sounds[path];
    if (buffer) return Promise.resolve(buffer);

    const url = pxt.webConfig.commitCdnUrl + "sounds/" + path;
    return pxt.Util.requestAsync({
        url,
        headers: {
            "Accept": "audio/" + path.slice(-3)
        },
        responseArrayBuffer: true
    }).then(resp => audio.loadAsync(resp.buffer))
      .then(buffer => sounds[path] = buffer)
}

function playSound(id: string) {
    if (pxt.options.light) return;

    loadSoundAsync(id)
        .done(buf => buf ? audio.play(buf, volume) : undefined);
}

export function tutorialStep() { playSound('tutorialStep'); }
export function tutorialNext() { playSound('tutorialNext'); }
export function click() { playSound('click'); }
export function initTutorial() {
    if (pxt.options.light) return;

    Promise.all([
        loadSoundAsync('tutorialStep'),
        loadSoundAsync('tutorialNext'),
        loadSoundAsync('click')
    ]).done();
}