import * as React from "react";

import { connect } from 'react-redux';
import { ImageEditorStore } from './store/imageReducer';
import { dispatchChangeInterval, dispatchChangePreviewAnimating } from './actions/dispatch';
import { IconButton } from "./Button";
import { CursorSizes } from "./CursorSizes";


export interface TopBarProps {
    dispatchChangeInterval: (interval: number) => void;
    interval: number;
    previewAnimating: boolean;
    dispatchChangePreviewAnimating: (animating: boolean) => void;
}

export interface TopBarState {
    interval?: string;
}

export class TopBarImpl extends React.Component<TopBarProps, TopBarState> {
    constructor(props: TopBarProps) {
        super(props);
        this.state = {};
    }

    render() {
        const { interval, previewAnimating, dispatchChangePreviewAnimating } = this.props;

        const intervalVal = this.state.interval == null ? interval : this.state.interval;

        return (
            <div className="image-editor-topbar">
                <div className="cursor-group">
                    <CursorSizes />
                </div>
                <div className="spacer"/>
                <div className="image-editor-seperator"/>
                <div className="timeline-controls">
                    <IconButton
                        onClick={() => dispatchChangePreviewAnimating(!previewAnimating)}
                        iconClass={previewAnimating ? "ms-Icon ms-Icon--Stop" : "ms-Icon ms-Icon--Play"}
                        title={previewAnimating ? "Stop Animation Preview" : "Play Animation Preview"}
                        toggle={true}
                    />
                    <div className="image-editor-interval-label image-editor-label">
                        <span className="ms-Icon ms-Icon--Clock" />
                    </div>
                    <div className="image-editor-interval">
                        <input className="image-editor-input"
                            title="Interval Between Frames (ms)"
                            value={intervalVal}
                            onChange={this.handleIntervalChange}
                            onBlur={this.handleIntervalBlur}
                            />
                    </div>
                </div>
            </div>
        );
    }

    protected handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ interval: event.target.value });
    }

    protected handleIntervalBlur = () => {
        const { dispatchChangeInterval } = this.props;

        const interval = parseInt(this.state.interval);

        if (!isNaN(interval)) {
            dispatchChangeInterval(Math.min(Math.max(interval, 50), 1000000));
        }

        this.setState({ interval: null });
    }
}

function mapStateToProps({ present: state, editor }: ImageEditorStore, ownProps: any) {
    if (!state) return {};

    return {
        interval: state.interval,
        previewAnimating: editor.previewAnimating
    };
}

const mapDispatchToProps = {
    dispatchChangeInterval,
    dispatchChangePreviewAnimating
};


export const TopBar = connect(mapStateToProps, mapDispatchToProps)(TopBarImpl);