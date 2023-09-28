import { useContext } from "react";
import { AppStateContext } from "../State/AppStateContext";
import ConfirmModal from "./ConfirmModal";
import { hideModal, postNotification } from "../State/Actions";
import { playSoundEffect } from "../Services/SoundEffectService";
import * as Storage from "../Services/LocalStorage";
import { removeGame } from "../Transforms/removeGame";
import { makeNotification } from "../Utils";

export default function AppModal() {
    const { state, dispatch } = useContext(AppStateContext);

    const cancelClicked = () => {
        playSoundEffect("select");
        dispatch(hideModal());
    };

    const deleteConfirmClicked = () => {
        pxt.tickEvent("kiosk.deleteGame.confirmed");
        playSoundEffect("select");
        deleteGame();
        dispatch(hideModal());
    };

    const selectedGame = state.allGames.find(
        g => g.id === state.selectedGameId
    );

    const deleteGame = () => {
        const userAddedGames = Storage.getUserAddedGames();
        const gameId = state.selectedGameId;
        if (gameId && gameId in userAddedGames) {
            const name = userAddedGames[gameId].name;
            userAddedGames[gameId].deleted = true;
            Storage.setUserAddedGames(userAddedGames);
            removeGame(gameId);
            dispatch(
                postNotification(makeNotification(`${name} deleted`, 5000))
            );
        }
    };

    switch (state.modal?.id) {
        case "delete-game-confirmation":
            return (
                <ConfirmModal
                    title={"Delete Game?"}
                    onCancel={cancelClicked}
                    onConfirm={deleteConfirmClicked}
                >
                    <div className="common-modal-body">
                        <p>
                            <b>{`Delete "${selectedGame?.name}"? `}</b>
                            {
                                "The only way to get the game back is by re-uploading it."
                            }
                        </p>
                    </div>
                </ConfirmModal>
            );
        default:
            return null;
    }
}
