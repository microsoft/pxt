import { useEffect, useState } from "react";
import "../Kiosk.css";
import { Kiosk } from "../Models/Kiosk";
import configData from "../config.json";
import { playSoundEffect } from "../Services/SoundEffectService";

interface IProps {
    kiosk: Kiosk;
    active: (p: boolean) => void;
    changeFocus: (p: boolean) => void;
}
const DeletionModal: React.FC<IProps> = ({ kiosk, active, changeFocus }) => {
    const [cancelButtonState, setCancelButtonState] = useState(true);
    const [confirmButtonState, setConfirmButtonState] = useState(false);
    const addedGamesLocalStorageKey: string = "UserAddedGames";

    const deleteGame = () => {
        const userAddedGames = kiosk.getAllAddedGames();
        const gameId = kiosk.selectedGame?.id!;
        if (gameId in userAddedGames) {
            userAddedGames[gameId].deleted = true;
            localStorage.setItem(
                addedGamesLocalStorageKey,
                JSON.stringify(userAddedGames)
            );
            kiosk.games.splice(kiosk.selectedGameIndex!, 1);
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
        if (kiosk.gamepadManager.isLeftPressed()) {
            if (!cancelButtonState) {
                playSoundEffect("switch");
            }
            setCancelButtonState(true);
            setConfirmButtonState(false);
        }
        if (kiosk.gamepadManager.isRightPressed()) {
            if (!confirmButtonState) {
                playSoundEffect("switch");
            }
            setCancelButtonState(false);
            setConfirmButtonState(true);
        }
        if (cancelButtonState && kiosk.gamepadManager.isAButtonPressed()) {
            kiosk.gamepadManager.blockAPressUntilRelease();
            pxt.tickEvent("kiosk.deleteGame.cancelled");
            playSoundEffect("select");
            cancelClicked();
        }

        if (confirmButtonState && kiosk.gamepadManager.isAButtonPressed()) {
            kiosk.gamepadManager.blockAPressUntilRelease();
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
