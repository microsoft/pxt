import css from "./styling/CriteriaFeedback.module.scss";
import { Button } from "react-common/components/controls/Button";
import { Ticks } from "../constants";
import { useState, useCallback } from "react";
import { showToast } from "../transforms/showToast";
import { makeToast } from "../utils";
import { classList } from "react-common/components/util";

interface ICriteriaFeedbackProps {
    catalogCriteriaId: string;
    className?: string;
}
export const CriteriaFeedback: React.FC<ICriteriaFeedbackProps> = ({ className, catalogCriteriaId }) => {
    const [helpful, setHelpful] = useState<boolean | undefined>(undefined);

    const onResponseClicked = useCallback(
        (isHelpful: boolean) => {
            const previousHelpful = helpful;

            // If they click the same button again, unset the feedback.
            const newHelpful = previousHelpful === isHelpful ? undefined : isHelpful;

            setHelpful(newHelpful);
            pxt.tickEvent(Ticks.CriteriaFeedback, {
                criteriaId: catalogCriteriaId,
                helpful: newHelpful + "",

                // Record previous value to help us track if the user is changing feedback that was already sent
                // (i.e. pressed thumbs up, then changed to thumbs down), or if they reset their feedback.
                previousValue: previousHelpful + "",
            });

            if (newHelpful !== undefined) {
                showToast(makeToast(newHelpful ? "success" : "info", lf("Thanks for your feedback!")));
            }
        },
        [helpful, catalogCriteriaId]
    );

    const thumbsUpIcon = helpful === true ? "fas fa-thumbs-up" : "far fa-thumbs-up";
    const thumbsDownIcon = helpful === false ? "fas fa-thumbs-down" : "far fa-thumbs-down";

    return (
        <div className={classList(css["criteria-feedback-container"], className)}>
            <span className={css["label"]}>{lf("Was this response helpful?")}</span>
            <span className={css["rate-buttons"]}>
                <Button
                    className={css["feedback-button"]}
                    title={lf("Helpful")}
                    onClick={() => onResponseClicked(true)}
                    rightIcon={thumbsUpIcon}
                />
                <Button
                    className={css["feedback-button"]}
                    title={lf("Unhelpful")}
                    onClick={() => onResponseClicked(false)}
                    rightIcon={thumbsDownIcon}
                />
            </span>
        </div>
    );
};
