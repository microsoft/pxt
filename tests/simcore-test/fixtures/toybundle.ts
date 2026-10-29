/// <reference path="../../../built/pxtsimcore.d.ts"/>

// The toy simulator bundle the simcore tests run on: the bare board with idle handlers, a
// cleanup message when the board is killed, `control.millis` reading the runtime's running time,
// and `testAudio.playAsync`, which plays two silent instruction steps lasting 300 ms and 200 ms
// and then posts a `testaudio` message carrying the running time it resolved at. Its first
// message is a `probe` describing the context it loaded in.

declare namespace pxsim.control {
    let millis: () => number;
}

declare namespace pxsim {
    let testAudio: { playAsync(): Promise<void> };
}

/** The first message the toy bundle posts: what the context it loaded in defines. */
interface ProbeMessage extends pxsim.SimulatorMessage {
    type: "probe";
    runtime: string;
    bareRuntime: string;
    globals: { [name: string]: string };
}

/** Posted when `testAudio.playAsync` resolves, with the running time it resolved at. */
interface TestAudioMessage extends pxsim.SimulatorMessage {
    type: "testaudio";
    resolvedAt: number;
}

pxsim.initHeadlessRuntime = function () {
    pxsim.initBareRuntime();
    const probe: ProbeMessage = {
        type: "probe",
        runtime: typeof pxsim.Runtime,
        bareRuntime: typeof pxsim.initBareRuntime,
        globals: {
            window: typeof window,
            document: typeof document,
            navigator: typeof navigator,
            location: typeof location,
            self: typeof self,
            HTMLElement: typeof HTMLElement,
            Element: typeof Element,
            localStorage: typeof localStorage
        }
    };
    pxsim.Runtime.postMessage(probe);
    pxsim.runtime.startIdle();
    pxsim.runtime.board.kill = function () {
        pxsim.Runtime.messagePosted({ type: "boardcleanup" });
    };
    pxsim.control.millis = function () { return pxsim.runtime.runningTime(); };
    const step = pxsim.music.INSTRUCTION_STEP_BYTES;
    const duration = pxsim.music.INSTRUCTION_DURATION_OFFSET;
    const instructions = new Uint8Array(2 * step);
    instructions[duration] = 300 & 0xff;
    instructions[duration + 1] = 300 >> 8;
    instructions[step + duration] = 200;
    pxsim.testAudio = {
        playAsync: function () {
            return pxsim.audiohost.audio().playInstructionsAsync(instructions).then(function () {
                const done: TestAudioMessage = { type: "testaudio", resolvedAt: pxsim.runtime.runningTime() };
                pxsim.Runtime.postMessage(done);
            });
        }
    };
};
