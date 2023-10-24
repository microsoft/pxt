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

    const lockedClassName = kiosk.locked ? " locked" : "";

    const ready = usePromise(AppStateReady, false);

    const gotoAddingGame = () => {
        pxt.tickEvent("kiosk.addGamePageLoaded");
        playSoundEffect("select");
        launchAddGame();
    };

    const canShowMainMenu = ready && kiosk.targetConfig;

    return (
        <>
            {!canShowMainMenu && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            {lf("Loading...")}
                        </h1>
                    </nav>
                </div>
            )}
            {canShowMainMenu && (
                <div className="mainMenu">
                    <nav className="mainMenuTopBar">
                        <h1 className={`mainMenuHeader${lockedClassName}`}>
                            {lf("Select a Game")}
                        </h1>
                        {!kiosk.locked && (
                            <div className="mainMenuButton">
                                <GenericButton
                                    title={lf("Add your game")}
                                    label={lf("Add your game")}
                                    onClick={gotoAddingGame}
                                    exitDirections={[NavGrid.NavDirection.Down]}
                                />
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
