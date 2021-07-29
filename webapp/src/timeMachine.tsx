import * as React from "react";
import * as workspace from "./workspace";
import * as sui from "./sui";


interface TimeMachineState {
    selectedTimestamp: number;
    selectedEditor: string;
}

interface TimeMachineProps {
    onTimestampSelect: (timestamp: number) => void;
    text: pxt.workspace.ScriptText;
    history: pxt.workspace.HistoryEntry[];
}

export class TimeMachine extends React.Component<TimeMachineProps, TimeMachineState> {
    protected handle: HTMLDivElement;
    protected container: HTMLDivElement;

    constructor(props: TimeMachineProps) {
        super(props);
        this.state = {
            selectedTimestamp: undefined,
            selectedEditor: undefined
        };
    }

    setSelectedTimestamp(timestamp: number) {
        const { text, history } = this.props;

        const printFiles = applyUntilTimestamp(text, history, timestamp);
        window.localStorage["printjob"] = JSON.stringify(printFiles);

        const config = JSON.parse(printFiles["pxt.json"]) as pxt.PackageConfig;

        this.setState({
            selectedTimestamp: timestamp,
            selectedEditor: config.preferredEditor !== pxt.BLOCKS_PROJECT_NAME ? "typescript" : "blocks"
        });
    }

    render() {
        const { history } = this.props;
        const { selectedEditor, selectedTimestamp } = this.state;

        const docsUrl = pxt.webConfig.docsUrl || '/--docs';

        const url = `${docsUrl}#preview:job:${selectedEditor}:${pxt.Util.localeInfo()}?timestamp=${selectedTimestamp}`;

        return <div className="time-machine">
            {/* <div className="time-machine-list">
                {history.map(entry =>
                    <div key={entry.timestamp}
                        role="button"
                        className={`time-machine-entry ${entry.timestamp === selectedTimestamp ? "selected" : ""}`}
                        onClick={() => this.setSelectedTimestamp(entry.timestamp)}>
                        {pxt.U.timeSince(entry.timestamp / 1000)}
                    </div>
                )}
            </div> */}
            <div className="time-machine-timeline">
                <div className="time-machine-label">
                    {pxt.U.lf("Past")}
                </div>
                <div className="time-machine-timeline-slider" ref={this.handleSliderContainerRef}>
                    <div className="time-machine-timeline-slider-handle" ref={this.handleSliderHandleRef}/>
                    <div className="time-machine-timeline-slider-background"/>
                </div>
                <div className="time-machine-label">
                    {pxt.U.lf("Present")}
                </div>
                <sui.Button
                    text={pxt.U.lf("Go")}
                    onClick={() => this.props.onTimestampSelect(selectedTimestamp)}
                    />
            </div>
            <div className="time-machine-preview">
                { selectedEditor && <iframe
                    frameBorder="0"
                    aria-label={lf("Print preview")}
                    sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                    src={url} />
                }
            </div>
        </div>
    }


    protected handleSliderHandleRef = (el: HTMLDivElement) => {
        if (el) this.handle = el;
    }

    protected handleSliderContainerRef = (el: HTMLDivElement) => {
        if (!el) return;

        let inGesture = false;

        const updatePosition = (e: MouseEvent) => {
            let { history } = this.props;
            history = history.slice(2);
            const bounds = el.getBoundingClientRect();

            const x = e.clientX - bounds.left;
            const y = e.clientY - bounds.top;

            if (this.handle) {
                this.handle.style.top = y + "px";
            }

            const percentage = y / bounds.height;

            const offset = Math.floor(percentage * history.length);

            if (history[offset] && history[offset].timestamp !== this.state.selectedTimestamp) {
                this.setSelectedTimestamp(history[offset].timestamp);
            }
        };

        this.container = el;
        el.addEventListener("mousedown", e => {
            inGesture = true;
            if (inGesture) updatePosition(e);
        })

        el.addEventListener("mouseup", e => {
            if (inGesture) updatePosition(e);
            inGesture = false;
        })

        el.addEventListener("mousemove", e => {
            if (inGesture) updatePosition(e);
        })

        el.addEventListener("mouseleave", e => {
            if (inGesture) updatePosition(e);
            inGesture = false;
        })
    }
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