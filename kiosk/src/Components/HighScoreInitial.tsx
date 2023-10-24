import { useEffect, useState } from "react";
import configData from "../config.json";
import * as GamepadManager from "../Services/GamepadManager";
import { useOnControlPress } from "../Hooks";

interface IProps {
    isSelected: boolean;
    onCharacterChanged: (initial: string) => void;
}

const HighScoreInitial: React.FC<IProps> = ({
    isSelected,
    onCharacterChanged,
}) => {
    const [index, setIndex] = useState(0);

    const getPreviousIndex = () =>
        (index + configData.HighScoreInitialAllowedCharacters.length - 1) %
        configData.HighScoreInitialAllowedCharacters.length;
    const getNextIndex = () =>
        (index + 1) % configData.HighScoreInitialAllowedCharacters.length;

    const previousInitial = () => {
        const newIndex = getPreviousIndex();
        setIndex(newIndex);
        onCharacterChanged(
            configData.HighScoreInitialAllowedCharacters[newIndex]
        );
    };

    const nextInitial = () => {
        const newIndex = getNextIndex();
        setIndex(newIndex);
        onCharacterChanged(
            configData.HighScoreInitialAllowedCharacters[newIndex]
        );
    };

    // Handle DPadUp button press
    useOnControlPress(
        [onCharacterChanged, isSelected, setIndex],
        () => isSelected && previousInitial(),
        GamepadManager.GamepadControl.DPadUp
    );

    // Handle DPadDown button press
    useOnControlPress(
        [onCharacterChanged, isSelected, setIndex],
        () => isSelected && nextInitial(),
        GamepadManager.GamepadControl.DPadDown
    );

    const classNames = [
        "highScoreInitialControl",
        "highScoreInitial",
        isSelected ? "highScoreInitialControlSelected" : "",
    ];

    return (
        <div className={classNames.join(" ")}>
            <div className="highScoreInitialText">
                {configData.HighScoreInitialAllowedCharacters[index]}
            </div>
        </div>
    );
};

export default HighScoreInitial;
