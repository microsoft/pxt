import { useEffect, useState, useContext, useMemo } from "react";
import configData from "../config.json";
import "../Kiosk.css";
import AddGameButton from "./AddGameButton";
import { QRCodeSVG } from "qrcode.react";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { gamepadManager } from "../Services/GamepadManager";
import { showMainMenu } from "../Transforms/showMainMenu";
import { generateKioskCodeAsync } from "../Services/AddingGamesService";

interface IProps {}

const AddingGame: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const [menuButtonSelected, setMenuButtonState] = useState(true);
    const [generatingKioskCode, setGeneratingKioskCode] = useState(false);

    const kioskTimeOutInMinutes = useMemo(() => {
        if (kiosk.time) {
            const kioskTime = parseInt(kiosk.time);
            return Math.min(240, Math.max(kioskTime, 0.5)) * 60;
        } else {
            return 30;
        }
    }, [kiosk.time]);

    const kioskLinkClicked = () => {
        pxt.tickEvent("kiosk.addGameLink");
        return true;
    };

    // Input loop
    useEffect(() => {
        const updateLoop = () => {
            if (!menuButtonSelected && gamepadManager.isDownPressed()) {
                setMenuButtonState(true);
                playSoundEffect("switch");
            }
            if (
                (menuButtonSelected && gamepadManager.isAButtonPressed()) ||
                gamepadManager.isBButtonPressed()
            ) {
                pxt.tickEvent("kiosk.toMainMenu");
                showMainMenu();
                playSoundEffect("select");
            }
        };

        updateLoop();
        const intervalId = setInterval(
            updateLoop,
            configData.GamepadPollLoopMilli
        );

        return () => clearInterval(intervalId);
    }, [menuButtonSelected]);

    // Generate kiosk code
    useEffect(() => {
        const generateOnce = () => {
            const generatedCodeDuration = kioskTimeOutInMinutes * 60 * 1000; // wait for kioskTimeOutInMinutes a.k.a until the kiosk code expires, backend has extra buffer

            if (kiosk.kioskCode) {
                return;
            }
            if (generatingKioskCode) {
                return;
            }

            setGeneratingKioskCode(true);

            generateKioskCodeAsync(generatedCodeDuration).then(newKioskCode => {
                setGeneratingKioskCode(false);
            });
        };

        generateOnce();
        const interval = setInterval(generateOnce, 750);
        return () => clearInterval(interval);
    }, [kiosk, kioskTimeOutInMinutes]);

    const qrDivContent = () => {
        if (kiosk.kioskCode) {
            const kioskUrl = `${window.location.origin}/kiosk#add-game:${kiosk.kioskCode}`;
            return (
                <div className="innerQRCodeContent">
                    <h3>{kioskTimeOutInMinutes} minute Kiosk ID</h3>
                    <h1 className="kioskCode">{kiosk.kioskCode}</h1>
                    <QRCodeSVG value={kioskUrl} />
                    <div className="kioskLink">
                        <a
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={kioskLinkClicked}
                            href={kioskUrl}
                        >
                            {kioskUrl}
                        </a>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="innerQRCodeContent">
                    <h3>Generating Kiosk ID...</h3>
                </div>
            );
        }
    };

    return (
        <div className="addGame">
            <h1>Add your game</h1>
            <div className="addGameContent">
                <div className="addInstructions">
                    <h2>How to upload your game</h2>
                    <ol>
                        <li>Use your mobile device to scan the QR code</li>
                        <li>
                            Use the new page to scan or enter your game's share
                            code
                        </li>
                        <li>
                            If your game is uploaded successfully, it will be
                            added to the game list
                        </li>
                    </ol>
                </div>

                <div className="QRCodeHolder">{qrDivContent()}</div>
            </div>
            <AddGameButton
                selected={menuButtonSelected}
                content="Return to menu"
            />
        </div>
    );
};

export default AddingGame;
