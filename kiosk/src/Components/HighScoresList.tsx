import { HighScore } from "../Models/HighScore";

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
            <h2 className="gameHighScoreHeader">High Scores</h2>
            {
                !highScoresExist && 
                <p className="gameHighScoreContent">None yet</p>
            }
            {
                highScoresExist &&
                <ol className="gameHighScoreContent">
                    {
                        highScores.slice(0, 5).map((highScore, index) => {
                            return (
                                <li key={index}>
                                    <span className="gameHighScoreInitials">{highScore.initials}</span>
                                    <span className="gameHighScoreScore">{highScore.score}</span>
                                </li>
                            )   
                        }

                        )
                    }
                </ol>
            }

        </div>
    );
}
  
export default HighScoresList;