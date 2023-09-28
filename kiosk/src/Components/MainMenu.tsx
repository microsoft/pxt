import { useContext } from "react";
import GenericButton from "./GenericButton";
import GameList from "./GameList";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext, AppStateReady } from "../State/AppStateContext";
import { launchAddGame } from "../Transforms/launchAddGame";
import { usePromise } from "../Hooks/usePromise";
import * as NavGrid from "../Services/NavGrid";

interface IProps {}

const MainMenu: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);

    const selectedGame = kiosk.allGames.find(
        g => g.id === kiosk.selectedGameId
    );

    const lockedClassName = kiosk.locked ? " locked" : "";

    const ready = usePromise(AppStateReady, false);

    const gotoAddingGame = () => {
        pxt.tickEvent("kiosk.addGamePageLoaded");
        playSoundEffect("select");
        launchAddGame();
    };

    return (
        <>
            {!ready && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            Initializing...
                        </h1>
                    </nav>
                </div>
            )}
            {ready && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            SELECT A GAME
                        </h1>
                        {!kiosk.locked && (
                            <div className="mainMenuButton">
                                <GenericButton
                                    onClick={gotoAddingGame}
                                    exitDirections={[NavGrid.NavDirection.Down]}
                                >
                                    {"Add your game"}
                                </GenericButton>
                            </div>
                        )}
                    </nav>
                    <GameList />
                </div>
            )}
        </>
    );
};

export default MainMenu;
