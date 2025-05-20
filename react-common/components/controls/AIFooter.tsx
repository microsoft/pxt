import { classList } from "../util";
import { ThumbsFeedback } from "./Feedback/ThumbsFeedback";

interface AIFooterProps {
    className?: string; // Optional class name to add to the footer
    onFeedbackSelected: (positive: boolean | undefined) => void; // Callback function to handle feedback selection
}

/**
 * A component containing a standard AI disclaimer and feedback buttons.
 */
export const AIFooter = (props: AIFooterProps) => {
    const {
        className,
        onFeedbackSelected
    } = props;

    return (
        <div className={classList("ai-footer", className)}>
            <div className="ai-footer-text">{lf("AI generated content may be incorrect.")}</div>
            <ThumbsFeedback lockOnSelect={true} onFeedbackSelected={onFeedbackSelected} />
        </div>
    );
};
