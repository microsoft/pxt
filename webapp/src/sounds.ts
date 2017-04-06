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

    loadSoundAsync(id).then(buf => audio.play(buf, volume));
}

export function tutorialStepNew() { playSound('tutorialnew'); }
export function tutorialStart() { playSound('tutorialstart'); }
export function pop() { playSound('pop'); }
export function initTutorial() {
    if (pxt.options.light || pxt.appTarget.appTheme.disableEditorSounds) return;

    Promise.all([
        loadSoundAsync('tutorialnew'),
        loadSoundAsync('tutorialstart')
    ]).done();
}