import { useEffect, useState, useContext } from "react";
import { KioskState } from "../Types";
import HighScoreInitial from "./HighScoreInitial";
import configData from "../config.json";
import { AppStateContext } from "../State/AppStateContext";
import { navigate } from "../Transforms/navigate";
import { saveHighScore } from "../Transforms/saveHighScore";
import * as GamepadManager from "../Services/GamepadManager";
import { useOnControlPress } from "../Hooks";

interface IProps {}

const NewScoreEntry: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);

    const [initials, setInitials] = useState(
        Array(configData.HighScoreInitialsLength + 1).join(
            configData.HighScoreInitialAllowedCharacters[0]
        )
    );
    const [timesAPressed, setTimesAPressed] = useState(0);

    // Handle A button press
    useOnControlPress(
        [timesAPressed, kiosk],
        () => {
            pxt.tickEvent("kiosk.newHighScore.nextInitial");
            GamepadManager.lockControl(GamepadManager.GamepadControl.AButton);
            setTimesAPressed(Math.min(3, timesAPressed + 1));
        },
        GamepadManager.GamepadControl.AButton
    );

    // Handle B button press
    useOnControlPress(
        [timesAPressed, kiosk],
        () => {
            pxt.tickEvent("kiosk.newHighScore.prevInitial");
            GamepadManager.lockControl(GamepadManager.GamepadControl.BButton);
            setTimesAPressed(Math.max(0, timesAPressed - 1));
        },
        GamepadManager.GamepadControl.BButton
    );

    // Handle Back button press
    useOnControlPress(
        [kiosk],
        () => {
            pxt.tickEvent("kiosk.newHighScore.defaultInitialsUsed");
            saveHighScore(
                kiosk.selectedGameId!,
                initials,
                kiosk.mostRecentScores[0]
            );
            navigate(KioskState.GameOver);
        },
        GamepadManager.GamepadControl.BackButton
    );

    // Handle all initials entered
    useEffect(() => {
        if (timesAPressed === 3) {
            pxt.tickEvent("kiosk.newHighScore.initialsEntered");
            saveHighScore(
                kiosk.selectedGameId!,
                initials,
                kiosk.mostRecentScores[0]
            );
            navigate(KioskState.GameOver);
        }
    }, [timesAPressed]);

    const updateInitial = (i: number, character: string) => {
        const newInitials = `${initials.substring(
            0,
            i
        )}${character}${initials.substring(i + 1)}`;
        setInitials(newInitials);
    };

    const renderInitials = (): JSX.Element[] => {
        const elements = [];

        for (let lcv = 0; lcv < configData.HighScoreInitialsLength; lcv++) {
            const thisIndex = lcv;
            elements.push(
                <HighScoreInitial
                    key={lcv}
                    isSelected={thisIndex === timesAPressed}
                    onCharacterChanged={character =>
                        updateInitial(thisIndex, character[0])
                    }
                />
            );
        }

        return elements;
    };

    return (
        <span>
            <span className="highScoreInitials">{renderInitials()}</span>
            <span className="highScoreScore">{kiosk.mostRecentScores[0]}</span>
        </span>
    );
};

export default NewScoreEntry;
