import * as React from 'react';
import { ImageEditorStore, CursorSize } from './store/imageReducer';
import { dispatchChangeCursorSize } from './actions/dispatch';
import { connect } from 'react-redux';

interface CursorSizesProps {
    selected: CursorSize;
    dispatchChangeCursorSize: (size: CursorSize) => void;
}


class CursorSizesImpl extends React.Component<CursorSizesProps, {}> {
    protected handlers: (() => void)[] = [];

    render() {
        const { selected } = this.props;
        return <div className="cursor-buttons">
            <div className={`cursor-button-outer ${selected === CursorSize.One ? "selected" : ""}`} title={lf("Small Cursor (1px)")} role="button" onClick={this.clickHandler(CursorSize.One)}>
                <div className="cursor-button small" />
            </div>
            <div className={`cursor-button-outer ${selected === CursorSize.Three ? "selected" : ""}`} title={lf("Medium Cursor (3px)")} role="button" onClick={this.clickHandler(CursorSize.Three)}>
                <div className="cursor-button medium" />
            </div>
            <div className={`cursor-button-outer ${selected === CursorSize.Five ? "selected" : ""}`} title={lf("Large Cursor (5px)")} role="button" onClick={this.clickHandler(CursorSize.Five)}>
                <div className="cursor-button large" />
            </div>
        </div>
    }

    clickHandler(size: CursorSize) {
        if (!this.handlers[size]) {
            this.handlers[size] = () => {
                const { dispatchChangeCursorSize } = this.props;
                dispatchChangeCursorSize(size);
            }
        }
        return this.handlers[size];
    }
}


function mapStateToProps({ editor }: ImageEditorStore, ownProps: any) {
    if (!editor) return {};
    return {
        selected: editor.cursorSize
    };
}

const mapDispatchToProps = {
    dispatchChangeCursorSize
};


export const CursorSizes = connect(mapStateToProps, mapDispatchToProps)(CursorSizesImpl);