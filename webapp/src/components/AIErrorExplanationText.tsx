import { ThumbsFeedback } from "../../../react-common/components/controls/Feedback/ThumbsFeedback";

interface AIErrorExplanationTextProps {
    explanation: string;
    onFeedbackSelected: (positive: boolean) => void;
}

/**
 * A simple component to encapsulate how we display paragraph-form AI generated error explanations.
 * Mostly exists to encapsulate the disclaimer and feedback footer.
 */
export const AIErrorExplanationText = (props: AIErrorExplanationTextProps) => {
    const {
        explanation,
        onFeedbackSelected,
    } = props;

    return (
        <div className="error-list-ai-explanation-container">
            <div className="explanation">{explanation}</div>
            <div className="ai-footer">
                <div>{lf("AI generated content may be incorrect.")}</div>
                <ThumbsFeedback lockOnSelect={true} onFeedbackSelected={onFeedbackSelected} />
            </div>
        </div>
    );
};
