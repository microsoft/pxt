import * as audio from "./audio";

const sounds: pxt.Map<AudioBuffer> = {};
const volume = 0.2;

function loadSoundAsync(id: string): Promise<AudioBuffer> {
    let buffer = sounds[id];
    if (buffer) return Promise.resolve(buffer);

    const url = pxt.webConfig.commitCdnUrl + "sounds/" + id + ".m4a";
    return Util.requestAsync({
        url,
        headers: {
            "Accept": "audio/m4a"
        },
        responseArrayBuffer: true
    }).then(resp => audio.loadAsync(resp.buffer))
        .then(buffer => sounds[id] = buffer)
}

function playSound(id: string) {
    if (pxt.options.light) return;

    loadSoundAsync(id).then(buf => audio.play(buf));
}

export function tutorialStepNew() { playSound('jing'); }
export function tutorialStepFinished() { playSound('jing'); }
export function tutorialStart() { playSound('dong'); }
export function initTutorial() {
    Promise.all([
        loadSoundAsync('jing'),
        loadSoundAsync('dong')
    ]).done();
}