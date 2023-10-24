import { useContext } from "react";
import { playSoundEffect } from "../Services/SoundEffectService";
import { launchGame } from "../Transforms/launchGame";
import { GameData, HighScore } from "../Types";
import { AppStateContext } from "../State/AppStateContext";
import HighScoresList from "./HighScoresList";
import { GameMenu } from "./GameMenu";
import { getHighScores } from "../State";

interface IProps {
    game: GameData;
}
const GameSlide: React.FC<IProps> = ({ game }) => {
    const { state: kiosk } = useContext(AppStateContext);

    const handleSlideClick = () => {
        pxt.tickEvent("kiosk.gameLaunched", { game: game.id });
        playSoundEffect("select");
        launchGame(game.id);
    };

    return (
        <div className="gameTile" onClick={handleSlideClick}>
            <div className="gameSelectionIndicator" />
            <div
                className="gameThumbnail"
                style={{
                    backgroundImage: `url("https://makecode.com/api/${game.id}/thumb")`,
                }}
            />

            <div className="gameDetails">
                <div className="gameTitle">{game.name}</div>
                <div className="gameDescription">{game.description}</div>
                <HighScoresList
                    highScores={getHighScores(game.id)}
                    highScoreMode={game.highScoreMode}
                />
                {game.date && (
                    <div className="gameDate">{lf("Added {0}", game.date)}</div>
                )}
            </div>

            {kiosk.selectedGameId && game.id === kiosk.selectedGameId && (
                <div className="pressStart">{lf("Press A to Start")}</div>
            )}

            {kiosk.selectedGameId && game.id === kiosk.selectedGameId && (
                <GameMenu />
            )}
        </div>
    );
};

export default GameSlide;
