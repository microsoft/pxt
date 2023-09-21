import NewScoreEntry from "./NewScoreEntry";
import ExistingScoreEntry from "./ExistingScoreEntry";
import { useEffect, useContext } from "react";
import { AppStateContext } from "../State/AppStateContext";
import { getHighScores } from "../State";

interface IProps {}

const EnterHighScore: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const existingHighScores = getHighScores(kiosk.selectedGameId);

    useEffect(() => {
        if (!kiosk.mostRecentScores || !kiosk.mostRecentScores.length) {
            throw new Error(
                "Cannot load high score entry view without having recent scores"
            );
        }
    }, []);

    const aboveScores = existingHighScores.filter(
        item => item.score > kiosk.mostRecentScores[0]
    );
    const belowScores = existingHighScores.slice(
        aboveScores.length,
        existingHighScores.length
    );

    return (
        <div className="enterHighScore">
            <div className="highScoreTitle">
                <h1>YOU GOT A HIGH SCORE!</h1>
                <h2>Enter your initials</h2>
            </div>
            <div className="highScoreContent">
                <div className="highScoreList">
                    <ol>
                        {aboveScores.map((highScore, i) => (
                            <ExistingScoreEntry
                                key={i}
                                highScoreInitials={highScore.initials}
                                highScoreScore={highScore.score}
                            />
                        ))}
                        <li>
                            <NewScoreEntry />
                        </li>
                        {belowScores.map((highScore, i) => (
                            <ExistingScoreEntry
                                key={i}
                                highScoreInitials={highScore.initials}
                                highScoreScore={highScore.score}
                            />
                        ))}
                    </ol>
                </div>

                <div className="highScoreInstructions">
                    <ul>
                        <li>Use up/down to scroll through the alphabet</li>
                        <li>When you find your initial, press A</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default EnterHighScore;
