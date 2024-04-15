import * as simulator from "../simulator";
import * as React from "react"
import * as screenshot from "../screenshot";
import { getEditorAsync } from "../app";
import { SimRecorder, SimRecorderRef, SimRecorderState } from "../../../react-common/components/share/ThumbnailRecorder";

import ScreenshotData = pxt.editor.ScreenshotData;

interface SimRecorderRefImpl extends SimRecorderRef {
    gifAddFrame(data: ImageData, delay?: number): boolean;
}

export const SimRecorderImpl: SimRecorder = props => {
    const { onSimRecorderInit } = props;

    const [loanedSimulator, setLoanedSimulator] = React.useState<HTMLElement>(undefined);

    React.useEffect(() => {
        const sim = simulator.driver.loanSimulator()
        setLoanedSimulator(sim);

        const ref = createSimRecorderRef();

        const onSimulatorMessage = (message: ScreenshotData) => {
            if ((message as any).type === "screenshot") {
                if (ref.state === "recording") {
                    // Adds frame, returns true if we've exceeded the max frame count
                    if (ref.gifAddFrame(message.data, message.delay)) {
                        ref.stopRecordingAsync();
                    }
                } else {
                    ref.screenshotAsync();
                }
            } else if (message.event === "start") {
                ref.startRecordingAsync();
            } else if (message.event === "stop") {
                ref.stopRecordingAsync();
            }
        }

        getEditorAsync().then(editor => {
            editor.pushScreenshotHandler(onSimulatorMessage)

            onSimRecorderInit(ref);
        })

        return () => {
            simulator.driver.unloanSimulator();
            simulator.driver.stopRecording();
            getEditorAsync().then(editor => {
                editor.popScreenshotHandler()
            })
        }
    }, [])

    let containerRef: HTMLDivElement;
    const handleContainerRef = (ref: HTMLDivElement) => {
        if (!ref) return;

        containerRef = ref;

        if (loanedSimulator && containerRef.firstChild !== loanedSimulator) {
            while (containerRef.firstChild) containerRef.firstChild.remove();
            containerRef.appendChild(loanedSimulator);
        }
    }

    return <div id="shareLoanedSimulator" ref={handleContainerRef}>
    </div>
}

let ref: SimRecorderRefImpl;
const MAX_RECORD_TIME_MS = 10 * 1000;

function createSimRecorderRef() {
    if (ref) return ref;
    let encoder: screenshot.GifEncoder;

    let handlers: ((newState: SimRecorderState) => void)[] = [];
    let thumbHandlers: ((uri: string, type: "gif" | "png") => void)[] = [];
    let errorHandlers: ((message: string) => void)[] = [];
    let timeoutRef: ReturnType<typeof setTimeout>;

    const addStateChangeListener = (handler: (newState: SimRecorderState) => void) => {
        handlers.push(handler);
    }

    const addThumbnailListener = (handler: (uri: string, type: "gif" | "png") => void) => {
        thumbHandlers.push(handler);
    }

    const addErrorListener = (handler: (message: string) => void) => {
        errorHandlers.push(handler);
    }

    const removeStateChangeListener = (handler: (newState: SimRecorderState) => void) => {
        handlers = handlers.filter(h => h !== handler);
    }

    const removeThumbnailListener = (handler: (uri: string, type: "gif" | "png") => void) => {
        thumbHandlers = thumbHandlers.filter(h => h !== handler);
    }

    const removeErrorListener = (handler: (message: string) => void) => {
        errorHandlers = errorHandlers.filter(h => h !== handler);
    }

    const setState = (state: SimRecorderState) => {
        ref.state = state;
        for (const handler of handlers) handler(state);
    }

    const setError = (message: string) => {
        for (const handler of errorHandlers) {
            handler(message);
        }
    }

    const startRecordingAsync = async () => {
        if (ref.state !== "default") return;
        if (!encoder) {
            encoder = await screenshot.loadGifEncoderAsync();
        }
        if (!encoder) {
            setError(lf("Unable to load GIF encoder. Are you offline?"))
            return;
        }
        encoder.cancel();
        encoder.start();
        const gifwidth = pxt.appTarget.appTheme.simGifWidth || 160;
        simulator.driver.startRecording(gifwidth);
        setState("recording");

        if (timeoutRef) clearTimeout(timeoutRef);
        timeoutRef = setTimeout(() => {
            if (ref.state === "recording") {
                stopRecordingAsync();
            }
        }, MAX_RECORD_TIME_MS)
    };

    const stopRecordingAsync = async () => {
        if (ref.state !== "recording") return undefined;
        simulator.driver.stopRecording();
        if (timeoutRef) clearTimeout(timeoutRef);
        setState("rendering");

        const uri = await encoder.renderAsync();
        pxt.log(`gif: ${uri?.length || 0} chars`)

        const maxSize = pxt.appTarget.appTheme.simScreenshotMaxUriLength;

        if (uri) {
            if (maxSize && uri.length > maxSize) {
                pxt.tickEvent(`gif.toobig`, { size: uri.length });
                setError(lf("Oops! The GIF you recorded is too large. Try recording a shorter clip!"))
                return undefined;
            } else
                pxt.tickEvent(`gif.ok`, { size: uri.length });
        }

        setState("default");

        for (const handler of thumbHandlers) handler(uri, "gif");

        return uri;
    }

    const screenshotAsync = async () => {
        const editor = await getEditorAsync();
        const uri = await editor.requestScreenshotAsync();

        for (const handler of thumbHandlers) handler(uri, "png");

        return uri;
    }

    const gifAddFrame = (data: ImageData, delay?: number) => {
        return encoder.addFrame(data, delay);
    }

    ref = {
        state: "default",
        addStateChangeListener,
        addThumbnailListener,
        addErrorListener,
        removeStateChangeListener,
        removeThumbnailListener,
        removeErrorListener,
        startRecordingAsync,
        stopRecordingAsync,
        screenshotAsync,
        gifAddFrame,
    };

    return ref;
}