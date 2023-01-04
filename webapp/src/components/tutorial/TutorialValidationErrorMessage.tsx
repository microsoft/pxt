import { Button } from "../../../../react-common/components/controls/Button";
import { TutorialValidationResult } from "../tutorialValidators";

interface TutorialValidationErrorMessageProps {
  onContinueClicked: () => void;
  onReturnClicked: () => void;
  validationFailures: TutorialValidationResult[];
}

export function TutorialValidationErrorMessage(
  props: TutorialValidationErrorMessageProps
) {
  return (
    <div className="tutorialCodeValidationError">
      <div>Something doesn't look quite right...</div>
      <br />
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
    </div>
  );
}
