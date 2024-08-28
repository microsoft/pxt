import css from "./styling/CriteriaFeedback.module.scss";
import { Button } from "react-common/components/controls/Button";
import { Ticks } from "../constants";
import { useCallback, useContext, useMemo } from "react";
import { classList } from "react-common/components/util";
import { AppStateContext } from "../state/appStateContext";
import { getCriteriaInstanceWithId } from "../state/helpers";
import { setUserFeedback } from "../transforms/setUserFeedback";

interface ICriteriaFeedbackProps {
    criteriaInstanceId: string;
    className?: string;
}

export const CriteriaFeedback: React.FC<ICriteriaFeedbackProps> = ({ className, criteriaInstanceId }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const catalogInstance = useMemo(
        () => getCriteriaInstanceWithId(teacherTool, criteriaInstanceId),
        [teacherTool, criteriaInstanceId]
    );
    const userFeedback = catalogInstance?.userFeedback;
    const catalogCriteriaId = catalogInstance?.catalogCriteriaId;

    const onResponseClicked = useCallback(
        (isHelpful: boolean) => {
            if (!catalogCriteriaId) {
                return;
            }

            setUserFeedback(criteriaInstanceId, isHelpful ? "helpful" : "not-helpful");

            pxt.tickEvent(Ticks.CriteriaFeedback, {
                criteriaId: catalogCriteriaId,
                helpful: isHelpful + "",
            });
        },
        [catalogCriteriaId]
    );

    const thumbsUpIcon = userFeedback === "helpful" ? "fas fa-thumbs-up" : "far fa-thumbs-up";
    const thumbsDownIcon = userFeedback === "not-helpful" ? "fas fa-thumbs-down" : "far fa-thumbs-down";

    return (
        <div className={classList(css["criteria-feedback-container"], className)}>
            <span className={css["label"]}>
                {!userFeedback ? lf("Was this response helpful?") : lf("Thanks for your feedback!")}
            </span>
            <span className={css["rate-buttons"]}>
                <Button
                    className={css["feedback-button"]}
                    title={lf("Helpful")}
                    onClick={() => onResponseClicked(true)}
                    rightIcon={thumbsUpIcon}
                    disabled={!!userFeedback}
                />
                <Button
                    className={css["feedback-button"]}
                    title={lf("Unhelpful")}
                    onClick={() => onResponseClicked(false)}
                    rightIcon={thumbsDownIcon}
                    disabled={!!userFeedback}
                />
            </span>
        </div>
    );
};
