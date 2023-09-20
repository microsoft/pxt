import { useEffect, useState, useContext } from "react";
import "../Kiosk.css";
import configData from "../config.json";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import * as Storage from "../Services/LocalStorage";
import { removeGame } from "../Transforms/removeGame";
import { gamepadManager } from "../Services/GamepadManager";
import { postNotification } from "../Transforms/postNotification";

interface IProps {
    active: (p: boolean) => void;
    changeFocus: (p: boolean) => void;
}
const DeletionModal: React.FC<IProps> = ({ active, changeFocus }) => {
    const { state: kiosk } = useContext(AppStateContext);

    const [cancelButtonState, setCancelButtonState] = useState(true);
    const [confirmButtonState, setConfirmButtonState] = useState(false);
    const addedGamesLocalStorageKey: string = "UserAddedGames";

    const deleteGame = () => {
        const userAddedGames = Storage.getAddedGames();
        const gameId = kiosk.selectedGameId;
        if (gameId && gameId in userAddedGames) {
            const name = userAddedGames[gameId].name;
            userAddedGames[gameId].deleted = true;
            Storage.setAddedGames(userAddedGames);
            removeGame(gameId);
            postNotification({
                message: `${name} deleted`,
                duration: 5000,
            });
        }
    };

    const cancelClicked = () => {
        active(false);
        changeFocus(false);
    };

    const confirmClicked = () => {
        deleteGame();
        cancelClicked();
    };

    const updateLoop = () => {
        if (gamepadManager.isLeftPressed()) {
            if (!cancelButtonState) {
                playSoundEffect("switch");
            }
            setCancelButtonState(true);
            setConfirmButtonState(false);
        }
        if (gamepadManager.isRightPressed()) {
            if (!confirmButtonState) {
                playSoundEffect("switch");
            }
            setCancelButtonState(false);
            setConfirmButtonState(true);
        }
        if (cancelButtonState && gamepadManager.isAButtonPressed()) {
            gamepadManager.blockAPressUntilRelease();
            pxt.tickEvent("kiosk.deleteGame.cancelled");
            playSoundEffect("select");
            cancelClicked();
        }

        if (confirmButtonState && gamepadManager.isAButtonPressed()) {
            gamepadManager.blockAPressUntilRelease();
            pxt.tickEvent("kiosk.deleteGame.confirmed");
            playSoundEffect("select");
            confirmClicked();
        }
    };

    useEffect(() => {
        let intervalId: any = null;

        intervalId = setInterval(() => {
            updateLoop();
        }, configData.GamepadPollLoopMilli);

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    });

    return (
        <div className="common-modal-container">
            <div className="common-modal">
                <div>
                    <div className="common-modal-header common-modal-title">
                        Delete the Game
                    </div>
                    <div className="common-modal-body">
                        <p>
                            Delete the game? The only way to get the game back
                            is by re-uploading it.
                        </p>
                    </div>
                    <div className="common-modal-footer">
                        <button
                            className={`common-modal-button cancel ${
                                cancelButtonState ? "selected" : ""
                            }`}
                            onClick={cancelClicked}
                        >
                            Cancel
                        </button>
                        <button
                            className={`common-modal-button confirm ${
                                confirmButtonState ? "selected" : ""
                            }`}
                            onClick={confirmClicked}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeletionModal;
