import * as React from "react";

import { Button } from "../../sui";
import { MarkedContent } from "../../marked";

interface TutorialHintProps {
    parent: pxt.editor.IProjectView;
    markdown: string;
}

export function TutorialHint(props: TutorialHintProps) {
    const { parent, markdown } = props;
    const [ visible, setVisible ] = React.useState(false);

    const captureEvent = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
    }

    const closeHint = (e: any) => {
        captureEvent(e);
        setVisible(false);
        document.removeEventListener("click", closeHint);
    }

    const toggleHint = () => {
        setVisible(!visible);
        if (!visible) {
            document.addEventListener("click", closeHint);
        } else {
            document.removeEventListener("click", closeHint);
        }
    }

    return <div className="tutorial-hint-container">
        <Button icon="lightbulb" className="tutorial-hint" disabled={!markdown} onClick={markdown ? toggleHint : undefined} />
        {visible && <div className={`tutorialhint no-select`} onClick={captureEvent}>
            <MarkedContent markdown={markdown} unboxSnippets={true} parent={parent} />
        </div>}
        {visible && <div className="tutorial-hint-mask" onClick={closeHint} />}
    </div>

}