import { useEffect, useRef, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import { KioskState } from "../Models/KioskState";
import configData from "../config.json"
import "../Kiosk.css";
import AddGameButton from "./AddGameButton";
import {QRCodeSVG} from 'qrcode.react';
import { generateKioskCodeAsync, getGameCodeAsync } from "../BackendRequests";
import { isLocal, tickEvent } from "../browserUtils";
import { GameData } from "../Models/GameData";
import KioskNotification from "./KioskNotification";
interface IProps {
    kiosk: Kiosk
}

const AddingGame: React.FC<IProps> = ({ kiosk }) => {
    const [kioskCode, setKioskCode] = useState("");
    const [renderQRCode, setRenderQRCode] = useState(true);
    const [menuButtonSelected, setMenuButtonState] = useState(false);
    const [qrCodeButtonSelected, setQrButtonState] = useState(false);
    const [notify, setNotify] = useState(false);
    const [notifyContent, setNotifyContent] = useState("");
    const generatingKioskCode = useRef(false);
    const kioskCodeNextGenerationTime = useRef(0);
    const nextSafePollTime = useRef(0);
    const kioskTimeOutInMinutes = 30;

    const updateLoop = () => {
        if (!menuButtonSelected && kiosk.gamepadManager.isDownPressed()) {
            setMenuButtonState(true);
            if (qrCodeButtonSelected) {
                setQrButtonState(false);
            }
        }
        if (menuButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            tickEvent("kiosk.toMainMenu");
            kiosk.showMainMenu();
        }
        if (!renderQRCode && kiosk.gamepadManager.isUpPressed()) {
            setMenuButtonState(false);
            setQrButtonState(true);
        }
        if (qrCodeButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            tickEvent("kiosk.newKioskCode");
            setRenderQRCode(true);
        }
    }

    const kioskLinkClicked = () => {
        tickEvent("kiosk.addGameLink");
        return true;
    }

    const getGameNames = (gameList: GameData[]): string[] => {
        const gameNames = [];
        for (const game of gameList) {
            gameNames.push(game.name);
        }
        return gameNames;
    }

    const displayGamesAdded = (addedGames: GameData[]): void => {
        const gameNames = getGameNames(addedGames);
        const games = gameNames.join(", ");
        const notification = `${games} added!`
        setNotifyContent(notification);
        setNotify(true);
    }

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

    useEffect(() => {
        let pollTimer: any;
        const pollDelay = 5000;

        const pollForGameCode = async () => {
            const timeElapsed = nextSafePollTime.current - Date.now();
            const timeToPoll = Math.max(Math.min(timeElapsed, pollDelay), 0);
            nextSafePollTime.current = Date.now() + pollDelay;

            clearTimeout(pollTimer);
            pollTimer = setTimeout(async () => {
                try {
                    const gameCodes = await getGameCodeAsync(kioskCode);
                    if (gameCodes) {
                        const justAddedGames = await kiosk.saveNewGamesAsync(gameCodes);
                        if (justAddedGames.length) {
                            displayGamesAdded(justAddedGames);
                        }
                    }
                    if (kioskCode) {
                        await pollForGameCode();
                    }
                } catch (error: any) {
                    clearTimeout(pollTimer);
                    setKioskCode("");
                    setRenderQRCode(false);
                }
            }, timeToPoll)
        }

        if (kioskCode) {
            pollForGameCode();
        }

        return () => {
            clearTimeout(pollTimer);
        }
    }, [kioskCode])

    useEffect(() => {
        let codeGenerationTimer: any;
        const generatedCodeDuration = kioskTimeOutInMinutes * 60 * 1000; // wait for kioskTimeOutInMinutes a.k.a until the kiosk code expires, backend has extra buffer

        const generateKioskCode = async () => {
            //TODO: maybe? spinner here to indicate work
            let newKioskCode: string;
            try {
                generatingKioskCode.current = true;
                newKioskCode = await generateKioskCodeAsync();
                kioskCodeNextGenerationTime.current = Date.now() + generatedCodeDuration;
                setKioskCode(newKioskCode);
            } catch (error) {
                setRenderQRCode(false);
            }
            generatingKioskCode.current = false;
        }

        if (!generatingKioskCode.current && renderQRCode) {
            if (!kioskCode) {
                generateKioskCode();
            } else {
                const timeElapsed = kioskCodeNextGenerationTime.current - Date.now();
                const time = Math.max(Math.min(timeElapsed, generatedCodeDuration), 0);
                codeGenerationTimer = setTimeout(() => {
                    setKioskCode("");
                    setRenderQRCode(false);
                }, time)
            }
        }

        return () => {
            clearTimeout(codeGenerationTimer);
        }
    }, [kioskCode, renderQRCode]);

    const qrDivContent = () => {
        if (renderQRCode && kioskCode) {
            const kioskUrl = `/kiosk/#add-game:${kioskCode}`;
            return (
                <div className="innerQRCodeContent">
                    <h3>{kioskTimeOutInMinutes} minute Kiosk ID</h3>
                    <h1 className="kioskCode">{kioskCode}</h1>
                    <QRCodeSVG value={kioskUrl} />
                    <div className="kioskLink">
                        <a target="_blank" onClick={kioskLinkClicked} href={kioskUrl}>{kioskUrl}</a>
                    </div>

                </div>
            )
        }
        else {
            return (
                <div className="innerQRCodeContent">
                    <AddGameButton selected={qrCodeButtonSelected} content="Generate new QR code" />
                </div>
            )
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
                        <li>Use the new page to scan or enter your game's share code</li>
                        <li>If the game is uploaded successfully, your game will be launched here</li>
                    </ol>
                </div>

                <div className="QRCodeHolder">
                    {qrDivContent()}
                </div>
            </div>
            <AddGameButton selected={menuButtonSelected} content="Return to menu" />
            {
                notify &&
                <KioskNotification setActive={setNotify} content={notifyContent} />
            }
        </div>

    )
}

export default AddingGame;