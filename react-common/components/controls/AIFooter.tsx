import { classList } from "../util";
import { ThumbsFeedback } from "./Feedback/ThumbsFeedback";

interface AIFooterProps {
    className?: string; // Optional class name to add to the footer
    feedbackLockOnSelect?: boolean; // If true, the user cannot change their feedback selection once made
    onFeedbackSelected: (positive: boolean | undefined) => void; // Callback function to handle feedback selection
}

/**
 * A component containing a standard AI disclaimer and feedback buttons.
 */
export const AIFooter = (props: AIFooterProps) => {
    const {
        className,
        feedbackLockOnSelect,
        onFeedbackSelected
    } = props;

    return (
        <div className={classList("ai-footer", className)}>
            <div className="ai-footer-text">{lf("AI generated content may be incorrect.")}</div>
            <ThumbsFeedback lockOnSelect={feedbackLockOnSelect} onFeedbackSelected={onFeedbackSelected} />
        </div>
    );
};
