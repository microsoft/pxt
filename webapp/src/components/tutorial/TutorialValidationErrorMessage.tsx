import * as React from "react";

import { Button } from "../../../../react-common/components/controls/Button";
import { Modal } from "../../../../react-common/components/controls/Modal";

interface TutorialValidationErrorMessageProps {
    onContinueClicked: () => void;
    onReturnClicked: () => void;
    hint: string;
}

export function TutorialValidationErrorMessage (props: TutorialValidationErrorMessageProps) {
    let [showHint, setShowHint] = React.useState(false);

    return <Modal title="Placeholder Title" onClose={props.onReturnClicked}>
        <div>Something doesn't look quite right...</div>
        {showHint && <div>{props.hint}</div>}
        <Button className="primary" onClick={props.onReturnClicked} title={lf("Go Back")} label={lf("Go Back")}/>
        {!showHint && <Button className="primary" onClick={() => setShowHint(true)} title={lf("Show Hint")} label={lf("Show Hint")}/>}
        {showHint && <Button className="primary" onClick={() => setShowHint(false)} title={lf("Hide Hint")} label={lf("Hide Hint")}/>}
        <Button className="secondary" onClick={props.onContinueClicked} title={lf("Continue Anyway")} label={lf("Continue Anyway")} />
    </Modal>
}