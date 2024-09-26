import * as React from 'react';
import { CursorSize, ImageEditorContext, changeCursorSize } from './state';
import { classList } from '../../../../react-common/components/util';

export const CursorSizes = () => {
    return (
        <div className="cursor-buttons">
            <CursorButton
                size={CursorSize.One}
                title={lf("Small Cursor (1px)")}
                className="small"
            />
            <CursorButton
                size={CursorSize.Three}
                title={lf("Medium Cursor (3px)")}
                className="medium"
            />
            <CursorButton
                size={CursorSize.Five}
                title={lf("Large Cursor (5px)")}
                className="large"
            />
        </div>
    );
}

const CursorButton = (props: {size: CursorSize, title: string, className: string}) => {
    const { state, dispatch } = React.useContext(ImageEditorContext);

    const { size, title, className } = props;

    const onClick = React.useCallback(() => {
        dispatch(changeCursorSize(size));
    }, [size, dispatch]);

    const isSelected = state.editor.cursorSize === size;

    return (
        <div
            className={classList("cursor-button-outer", isSelected && "selected")}
            title={title}
            role="button"
            onClick={onClick}
        >
            <div className={classList("cursor-button", className)} />
        </div>
    );
}
