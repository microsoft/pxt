import * as React from "react";
import * as workspace from "./workspace";
import { Button } from "../../react-common/components/controls/Button";

interface TimeMachineProps {
    onTimestampSelect: (timestamp: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryEntry[];
}

interface State {
    timestamp: number;
    editor: string;
}

export const TimeMachine = (props: TimeMachineProps) => {
    const { onTimestampSelect, text, history } = props;

    const [selected, setSelected] = React.useState<State>();

    const handleRef = React.useRef<HTMLDivElement>();
    const containerRef = React.useRef<HTMLDivElement>();
    const backgroundRef = React.useRef<HTMLDivElement>();

    React.useEffect(() => {
        let inGesture = false;

        const onGestureEnd = (e: PointerEvent) => {
            if (!inGesture) return;
            updatePosition(e);
            inGesture = false;

            const truncatedHistory = history.slice(2);
            const bounds = backgroundRef.current.getBoundingClientRect();

            const y = e.clientY - bounds.top;

            const percentage = Math.min(1, Math.max(y / bounds.height, 0));
            const entry = truncatedHistory[Math.round(percentage * truncatedHistory.length)];

            if (entry && entry.timestamp !== selected?.timestamp) {
                const printFiles = applyUntilTimestamp(text, history, entry.timestamp);
                window.localStorage["printjob"] = JSON.stringify(printFiles);

                const config = JSON.parse(printFiles["pxt.json"]) as pxt.PackageConfig;

                setSelected({
                    timestamp: entry.timestamp,
                    editor: config.preferredEditor !== pxt.BLOCKS_PROJECT_NAME ? "typescript" : "blocks"
                });
            }
        }

        const updatePosition = (e: PointerEvent) => {
            if (!inGesture) return;
            const bounds = backgroundRef.current.getBoundingClientRect();
            const y = e.clientY - bounds.top;

            const percentage = Math.min(1, Math.max(y / bounds.height, 0));

            const offset = Math.round(percentage * (history.length - 2)) * (bounds.height / (history.length - 2));

            handleRef.current.style.top = offset + "px";
        };

        const pointerdown = (e: PointerEvent) => {
            inGesture = true;
            updatePosition(e);
        };

        const pointerup = (e: PointerEvent) => {
            onGestureEnd(e);
        };

        const pointermove = (e: PointerEvent) => {
            updatePosition(e);
        };

        const pointerleave = (e: PointerEvent) => {
            onGestureEnd(e);
        };

        containerRef.current.addEventListener("pointerdown", pointerdown);
        containerRef.current.addEventListener("pointerup", pointerup);
        containerRef.current.addEventListener("pointermove", pointermove);
        containerRef.current.addEventListener("pointerleave", pointerleave);

        return () => {
            containerRef.current.removeEventListener("pointerdown", pointerdown);
            containerRef.current.removeEventListener("pointerup", pointerup);
            containerRef.current.removeEventListener("pointermove", pointermove);
            containerRef.current.removeEventListener("pointerleave", pointerleave);
        }
    }, [history, selected]);

    const onGoPressed = React.useCallback(() => {
        onTimestampSelect(selected.timestamp);
    }, [selected, onTimestampSelect]);

    const docsUrl = pxt.webConfig.docsUrl || '/--docs';
    const url = `${docsUrl}#preview:job:${selected?.editor}:${pxt.Util.localeInfo()}?timestamp=${selected?.timestamp}`;
    const selectableHistory = history.slice(2);

    return (
        <div className="time-machine">
            <div className="time-machine-timeline">
                <div className="time-machine-label">
                    {pxt.U.lf("Past")}
                </div>
                <div className="time-machine-timeline-slider" ref={containerRef}>
                    <div className="time-machine-timeline-slider-handle" ref={handleRef}/>
                    <div className="time-machine-timeline-slider-background" ref={backgroundRef}>
                        {selectableHistory.map((_, index) => <div className="time-machine-timeline-entry" key={index} />)}
                    </div>
                </div>
                <div className="time-machine-label">
                    {pxt.U.lf("Present")}
                </div>
                <Button
                    className="primary"
                    label={pxt.U.lf("Go")}
                    title={pxt.U.lf("Restore editor to selected version")}
                    onClick={onGoPressed}
                />
            </div>
            <div className="time-machine-preview">
                { selected && <iframe
                    frameBorder="0"
                    aria-label={lf("Print preview")}
                    sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                    src={url} />
                }
            </div>
        </div>
    );
}

function applyUntilTimestamp(text: pxt.workspace.ScriptText, history: pxt.workspace.HistoryEntry[], timestamp: number) {
    let currentText = { ...text };

    for (let i = 0; i < history.length; i++) {
        const entry = history[history.length - 1 - i];
        currentText = workspace.applyDiff(currentText, entry, false);
        if (entry.timestamp === timestamp) break;
    }

    return currentText;
}