import * as React from "react";

import { Button } from "../../sui";
import { MarkedContent } from "../../marked";

interface TutorialHintProps {
    parent: pxt.editor.IProjectView;
    markdown: string;

    showLabel?: boolean;
}

export function TutorialHint(props: TutorialHintProps) {
    const { parent, markdown, showLabel } = props;
    const [ visible, setVisible ] = React.useState(false);

    const captureEvent = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
    }

    const closeHint = (e: any) => {
        document.removeEventListener("click", closeHint);
        setVisible(false);
    }

    const toggleHint = () => {
        if (!visible) {
            document.addEventListener("click", closeHint);
        } else {
            document.removeEventListener("click", closeHint);
        }
        setVisible(!visible);
    }

    return <div className="tutorial-hint-container">
        <Button icon="lightbulb" text={showLabel ? lf("Hint") : undefined} className="tutorial-hint"
            disabled={!markdown} onClick={markdown ? toggleHint : undefined} />
        {visible && <div className={`tutorialhint no-select`} onClick={captureEvent}>
            <MarkedContent markdown={markdown} unboxSnippets={true} parent={parent} />
        </div>}
        {visible && <div className="tutorial-hint-mask" onClick={closeHint} />}
    </div>

}