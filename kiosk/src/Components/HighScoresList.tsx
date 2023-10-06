import { HighScore } from "../Types";

interface IProps {
    highScores: HighScore[];
    highScoreMode: string;
}

const HighScoresList: React.FC<IProps> = ({ highScores, highScoreMode }) => {
    const highScoresExist = !!highScores.length;

    if (highScoreMode === "None") {
        return null;
    }

    return (
        <div className="gameHighScores">
            <h2 className="gameHighScoreHeader">{lf("High Scores")}</h2>
            {!highScoresExist && (
                <p className="gameHighScoreContent">{lf("None yet")}</p>
            )}
            {highScoresExist && (
                <ol className="gameHighScoreContent">
                    {highScores.slice(0, 5).map((highScore, index) => {
                        return (
                            <li key={index}>
                                <span className="gameHighScoreInitials">
                                    {highScore.initials}
                                </span>
                                <span className="gameHighScoreScore">
                                    {highScore.score}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default HighScoresList;
