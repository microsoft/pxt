import { useEffect, useState } from "react";
import { HighScore } from "../Models/HighScore";
import { Kiosk } from "../Models/Kiosk";
import { KioskState } from "../Models/KioskState";
import HighScoreInitial from "./HighScoreInitial";
import configData from "../config.json"
import { tickEvent } from "../browserUtils";

interface IProps {
    kiosk: Kiosk
  }

const NewScoreEntry: React.FC<IProps> = ({ kiosk }) => {
    const [indexChanged, setIndexChanged] = useState(false);
    const [nextIndex, setNextIndex] = useState(false);
    const [previousIndex, setPreviousIndex] = useState(false);

    const [initials, setInitials] = useState(Array(configData.HighScoreInitialsLength + 1).join(configData.HighScoreInitialAllowedCharacters[0]));
    const [timesAPressed, setTimesAPressed] = useState(0);
    const [runOnce, setRunOnce] = useState(false);
    const [firstRun, setFirstRun] = useState(true);

    const gamepadLoop = () => {
        if (kiosk.state !== KioskState.EnterHighScore) { return; }

        if (kiosk.gamepadManager.isAButtonPressed()) {
            tickEvent("kiosk.newHighScore.nextInitial");
            setIndexChanged(true);
            setNextIndex(true);
        } 

        else if (kiosk.gamepadManager.isBButtonPressed()) {
            tickEvent("kiosk.newHighScore.prevInitial");
            setIndexChanged(true);
            setPreviousIndex(true);
        } 
        else {
            setIndexChanged(false);
            setPreviousIndex(false);
            setNextIndex(false);

        }

        if (kiosk.gamepadManager.isEscapeButtonPressed()) {
            tickEvent("kiosk.newHighScore.defaultInitialsUsed");
            kiosk.saveHighScore(kiosk.selectedGame!.id, initials, kiosk.mostRecentScores[0]);
            kiosk.navigate(KioskState.GameOver);
        }
    };

    useEffect(() => {
        let interval: any;
        let timeout: any;
        timeout = setTimeout(() => {
            interval = setInterval(() =>
                gamepadLoop(),
                configData.EnterHighScorePoll
            )
        }, configData.EnterHighScoreDelayMilli)


        return () => {
            if (interval) {
                clearInterval(interval);
            }
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    }, []);

    const decrementTimesPressed = () => {
        if (timesAPressed === 0) {
            return 0;
        } else {
            setTimesAPressed(timesAPressed - 1);
            return timesAPressed - 1;
        }
    }

    const updateTimesPressed = () => {
        if (runOnce) {
            setRunOnce(false);
            return timesAPressed;
        }
        else if (firstRun) {
            setFirstRun(false);
            return timesAPressed;
        }
        else {
            setRunOnce(true);
            if (nextIndex) {
                setTimesAPressed(timesAPressed + 1);
                return timesAPressed + 1;
            } 
            else if (previousIndex) {
                return decrementTimesPressed();
            } else {
                return timesAPressed;
            }
        }
    }

    useEffect(() => {
        const updatedPressed = updateTimesPressed();


        if (updatedPressed >= 3) {
            setTimesAPressed(0);
            tickEvent("kiosk.newHighScore.initialsEntered");
            kiosk.saveHighScore(kiosk.selectedGame!.id, initials, kiosk.mostRecentScores[0]);
            kiosk.navigate(KioskState.GameOver);
        }

    }, [indexChanged]);


    const updateInitial = (i: number, character: string) => {
        const newInitials = `${initials.substring(0, i)}${character}${initials.substring(i + 1)}`;
        setInitials(newInitials);
    }

    const renderInitials = (): JSX.Element[] => {
        const elements = [];

        for (let lcv = 0; lcv < configData.HighScoreInitialsLength; lcv++) {
            const thisIndex = lcv;
            elements.push(
                <HighScoreInitial kiosk={kiosk} key={lcv} isSelected={thisIndex === timesAPressed}
                    onCharacterChanged={character => updateInitial(thisIndex, character[0])} />
            );
        }

        return elements;
    }

    return (
        <span>
            <span className="highScoreInitials">{renderInitials()}</span>
            <span className="highScoreScore">{kiosk.mostRecentScores[0]}</span>
        </span>

    )
}

export default NewScoreEntry;