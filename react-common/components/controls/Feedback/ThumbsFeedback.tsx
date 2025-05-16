import * as React from "react";
import { classList } from "../../util";
import { Button } from "../Button";

interface ThumbsFeedbackProps {
    onFeedbackSelected: (positive: boolean | undefined) => void;
    lockOnSelect?: boolean;
    positiveFeedbackText?: string;
    negativeFeedbackText?: string;
    rootClassName?: string;
    positiveClassName?: string;
    negativeClassName?: string;
}
export const ThumbsFeedback = (props: ThumbsFeedbackProps) => {
    const {
        lockOnSelect,
        onFeedbackSelected,
        positiveFeedbackText,
        negativeFeedbackText,
        rootClassName,
        positiveClassName,
        negativeClassName,
    } = props;
    const [selectedFeedback, setSelectedFeedback] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        onFeedbackSelected(selectedFeedback);
    }, [selectedFeedback]);

    const handleFeedbackSelected = (positive: boolean) => {
        if (positive === selectedFeedback) {
            // If the user clicks the same feedback button again, reset it
            setSelectedFeedback(undefined);
        } else {
            setSelectedFeedback(positive);
        }
    };

    const positiveText = positiveFeedbackText || lf("Helpful");
    const negativeText = negativeFeedbackText || lf("Not Helpful");
    const lockButtons = lockOnSelect && selectedFeedback !== undefined;
    return (
        <div className={classList("feedback-buttons", rootClassName)}>
            <Button
                className={classList("feedback-button", positiveClassName, selectedFeedback ? "selected" : undefined)}
                onClick={() => handleFeedbackSelected(true)}
                title={positiveText}
                ariaLabel={positiveText}
                leftIcon={selectedFeedback ? "fas fa-thumbs-up" : "far fa-thumbs-up"}
                disabled={lockButtons}
            />
            <Button
                className={classList(
                    "feedback-button",
                    negativeClassName,
                    selectedFeedback === false ? "selected" : undefined
                )}
                onClick={() => handleFeedbackSelected(false)}
                title={negativeText}
                ariaLabel={negativeText}
                leftIcon={selectedFeedback === false ? "fas fa-thumbs-down" : "far fa-thumbs-down"}
                disabled={lockButtons}
            />
        </div>
    );
};
