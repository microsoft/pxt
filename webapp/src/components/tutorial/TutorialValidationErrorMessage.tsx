import { Button } from "../../../../react-common/components/controls/Button";
import { Modal } from "../../../../react-common/components/controls/Modal";

interface TutorialValidationErrorMessageProps {
    onContinueClicked: () => void;
    onReturnClicked: () => void;
}

export function TutorialValidationErrorMessage (props: TutorialValidationErrorMessageProps) {
    return <Modal title="Placeholder Title" onClose={props.onReturnClicked}>
        <div>Something doesn't look quite right...</div>
        <Button className="primary" onClick={props.onReturnClicked} title={lf("Go Back")} label={lf("Go Back")}/>
        <Button className="secondary" onClick={props.onContinueClicked} title={lf("Continue Anyway")} label={lf("Continue Anyway")} />
    </Modal>
}