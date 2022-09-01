import * as simulator from "../simulator";
import * as React from "react"
import * as screenshot from "../screenshot";
import { getEditorAsync } from "../app";
import { SimRecorder, SimRecorderRef, SimRecorderState } from "../../../react-common/components/share/GifRecorder";

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

        const onSimulatorMessage = (message: pxt.editor.ScreenshotData) => {
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
            if (loanedSimulator) {
                simulator.driver.unloanSimulator();
                simulator.driver.stopRecording();
            }
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

function createSimRecorderRef() {
    if (ref) return ref;
    let encoder: screenshot.GifEncoder;
    ref = {
        state: "default"
    } as any

    const handlers: ((newState: SimRecorderState) => void)[] = [];
    const thumbHandlers: ((uri: string, type: "gif" | "png") => void)[] = [];

    const onStateChange = (handler: (newState: SimRecorderState) => void) => {
        handlers.push(handler);
    }

    const onThumbnail = (handler: (uri: string, type: "gif" | "png") => void) => {
        thumbHandlers.push(handler);
    }

    const setState = (state: SimRecorderState) => {
        ref.state = state;
        for (const handler of handlers) handler(state);
    }

    const recordGifAsync = async () => {
        if (ref.state !== "default") return;
        if (!encoder) {
            encoder = await screenshot.loadGifEncoderAsync();
        }
        if (!encoder) {
            // TODO: display error
            return;
        }

        encoder.start();
        const gifwidth = pxt.appTarget.appTheme.simGifWidth || 160;
        simulator.driver.startRecording(gifwidth);
        setState("recording");
    };

    const renderGifAsync = async () => {
        if (ref.state !== "recording") return undefined;
        simulator.driver.stopRecording();
        setState("rendering");

        const uri = await encoder.renderAsync();
        pxt.log(`gif: ${uri?.length || 0} chars`)

        const maxSize = pxt.appTarget.appTheme.simScreenshotMaxUriLength;

        if (uri) {
            if (maxSize && uri.length > maxSize) {
                pxt.tickEvent(`gif.toobig`, { size: uri.length });
                // recordError = lf("Gif is too big, try recording a shorter time.");
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

    ref.onStateChange = onStateChange;
    ref.onThumbnail = onThumbnail;
    ref.startRecordingAsync = recordGifAsync;
    ref.stopRecordingAsync = renderGifAsync;
    ref.screenshotAsync = screenshotAsync
    ref.gifAddFrame = gifAddFrame;

    return ref as SimRecorderRefImpl;
}