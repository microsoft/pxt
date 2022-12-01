import { Button } from "../../../../react-common/components/controls/Button";
import { Modal } from "../../../../react-common/components/controls/Modal";
import { TutorialRuleResult } from "../tutorialRules";

interface TutorialValidationErrorMessageProps {
  onContinueClicked: () => void;
  onReturnClicked: () => void;
  validationFailures: TutorialRuleResult[];
}

export function TutorialValidationErrorMessage(
  props: TutorialValidationErrorMessageProps
) {
  return (
    <Modal title="Placeholder Title" onClose={props.onReturnClicked}>
      <div>Something doesn't look quite right...</div>
      <div className="tabTutorial">
        {props.validationFailures.map((f) => {
          return f.hint ? (
            <details>
              <summary>View Hint</summary>
              {f.hint}
            </details>
          ) : null;
        })}
      </div>
      <Button
        className="primary"
        onClick={props.onReturnClicked}
        title={lf("Go Back")}
        label={lf("Go Back")}
      />
      <Button
        className="secondary"
        onClick={props.onContinueClicked}
        title={lf("Continue Anyway")}
        label={lf("Continue Anyway")}
      />
    </Modal>
  );
}
