import * as React from 'react';
import { ImageEditorStore, CursorSize } from './store/imageReducer';
import { dispatchChangeCursorSize } from './actions/dispatch';
import { connect } from 'react-redux';
import { Button } from '../../../../react-common/components/controls/Button';
import { classList } from '../../../../react-common/components/util';

interface CursorSizesProps {
    selected: CursorSize;
    dispatchChangeCursorSize: (size: CursorSize) => void;
}


class CursorSizesImpl extends React.Component<CursorSizesProps, {}> {
    protected handlers: (() => void)[] = [];

    render() {
        const { selected } = this.props;
        return (
            <div className="cursor-buttons">
                <Button
                    className={classList("image-editor-button", selected !== CursorSize.One && "toggle")}
                    title={lf("Small Cursor (1px)")}
                    label={<div className="cursor-button small" />}
                    onClick={this.clickHandler(CursorSize.One)}
                />
                <Button
                    className={classList("image-editor-button", selected !== CursorSize.Three && "toggle")}
                    title={lf("Small Cursor (3px)")}
                    label={<div className="cursor-button medium" />}
                    onClick={this.clickHandler(CursorSize.Three)}
                />
                <Button
                    className={classList("image-editor-button", selected !== CursorSize.Five && "toggle")}
                    title={lf("Small Cursor (5px)")}
                    label={<div className="cursor-button large" />}
                    onClick={this.clickHandler(CursorSize.Five)}
                />
            </div>
        );
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