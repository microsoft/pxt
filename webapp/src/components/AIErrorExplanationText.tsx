import { AIFooter } from "../../../react-common/components/controls/AIFooter";

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
        <div className="ai-explanation-container">
            <div className="explanation">{explanation}</div>
            <AIFooter onFeedbackSelected={onFeedbackSelected} feedbackLockOnSelect={true} />
        </div>
    );
};
