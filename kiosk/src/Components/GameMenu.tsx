import { useContext, useMemo } from "react";
import { GameData, makeDeleteGameModal } from "../Types";
import { AppStateContext } from "../State/AppStateContext";
import GenericButton from "./GenericButton";
import * as NavGrid from "../Services/NavGrid";
import { showModal } from "../State/Actions";
import * as GamepadManager from "../Services/GamepadManager";

export interface IProps {}

export const GameMenu: React.FC<IProps> = () => {
    const { state: kiosk, dispatch } = useContext(AppStateContext);
    const { selectedGameId } = kiosk;

    const game = useMemo(
        () => kiosk.allGames.find((g: GameData) => g.id === selectedGameId),
        [kiosk.allGames, selectedGameId]
    );

    const handleDeleteClick = () => {
        if (game) {
            GamepadManager.lockControl(GamepadManager.GamepadControl.AButton);
            dispatch(showModal(makeDeleteGameModal(game.id)));
        }
    };

    return (
        <div className="gameMenu">
            {game?.userAdded && !kiosk.locked && (
                <GenericButton
                    title={lf("Delete Game")}
                    classNameReplace="deleteGame"
                    onClick={handleDeleteClick}
                    exitDirections={[NavGrid.NavDirection.Up]}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 448 512"
                    >
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z" />
                    </svg>
                    <p>{lf("Delete Game")}</p>
                </GenericButton>
            )}
        </div>
    );
};
