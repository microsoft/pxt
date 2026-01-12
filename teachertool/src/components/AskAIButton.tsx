import { useContext } from "react";

import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";

import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { setAskAiOpen } from "../transforms/setAskAiOpen";

export interface AskAIButtonProps {}

export const AskAIButton: React.FC<AskAIButtonProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const isSelected = !!teacherTool.askAiOpen;
    const onClick = () => setAskAiOpen(!isSelected);

    return (
        <Button
            className={classList("inline", "outline-button")}
            label={Strings.AskAI}
            onClick={onClick}
            title={Strings.AskAI}
            leftIcon="fas fa-robot"
            rightIcon={isSelected ? "fas fa-check" : undefined}
        />
    );
};
