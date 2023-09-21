import { useEffect, useState, useContext } from "react";
import configData from "../config.json";
import { AppStateContext } from "../State/AppStateContext";
import { gamepadManager } from "../Services/GamepadManager";

interface IProps {
    isSelected: boolean;
    onCharacterChanged: (initial: string) => void;
}

const HighScoreInitial: React.FC<IProps> = ({
    isSelected,
    onCharacterChanged,
}) => {
    const { state: kiosk } = useContext(AppStateContext);
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

    useEffect(() => {
        const gamepadLoop = () => {
            if (!isSelected) {
                return;
            }

            if (gamepadManager.isUpPressed()) {
                pxt.tickEvent("kiosk.newHighScore.upPressed");
                previousInitial();
            }

            if (gamepadManager.isDownPressed()) {
                pxt.tickEvent("kiosk.newHighScore.downPressed");
                nextInitial();
            }
        };

        const interval = setInterval(
            () => gamepadLoop(),
            configData.GamepadPollLoopMilli
        );
        return () => clearInterval(interval);
    });

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
