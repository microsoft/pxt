import { useContext, useMemo, useState } from "react";
import { playSoundEffect } from "../Services/SoundEffectService";
import { launchGame } from "../Transforms/launchGame";
import { GameData } from "../Types";
import { AppStateContext } from "../State/AppStateContext";
import HighScoresList from "./HighScoresList";
import { GameMenu } from "./GameMenu";
import { getHighScores } from "../State";
import { getEffectiveGameId } from "../Utils";

interface IProps {
    game: GameData;
    generation: number; // Enables GameList to force a re-render of GameSlide when carousel transitions
}
const GameSlide: React.FC<IProps> = ({ game, generation }) => {
    const { state: kiosk } = useContext(AppStateContext);
    const [myParentRef, setMyParentRef] = useState<
        HTMLElement | null | undefined
    >(null);

    const handleRef = (el: HTMLElement | null) => {
        setMyParentRef(el?.parentElement);
    };

    const isSelected = useMemo(() => {
        let selected = kiosk.selectedGameId === game.id;
        if (myParentRef) {
            selected =
                selected &&
                myParentRef.classList.contains("swiper-slide-active");
        }
        return selected;
    }, [
        kiosk.selectedGameId,
        game.id,
        myParentRef,
        // `generation` is included here to force re-render when carousel
        // transitions. This is a workaround for Swiper's direct DOM
        // manipulation .. React doesn't always know about it.
        generation,
    ]);

    const handleSlideClick = () => {
        pxt.tickEvent("kiosk.gameLaunched", { game: game.id });
        playSoundEffect("select");
        launchGame(game.id);
    };

    const thumbnailUrl = useMemo(() => {
        if (game) {
            const gameId = getEffectiveGameId(game);
            return `url("https://makecode.com/api/${gameId}/thumb")`;
        }
    }, [game, game?.tempGameId]);

    return (
        <div className="gameTile" onClick={handleSlideClick} ref={handleRef}>
            <div className="gameSelectionIndicator" />
            <div
                className="gameThumbnail"
                style={{
                    backgroundImage: thumbnailUrl,
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

            {isSelected && (
                <div className="pressStart">{lf("Press A to Start")}</div>
            )}

            {isSelected && <GameMenu />}
        </div>
    );
};

export default GameSlide;
