import React, {
    useEffect,
    useRef,
    useState,
    useContext,
    useCallback,
} from "react";
import { KioskState } from "../Types";
import configData from "../config.json";
import "../Kiosk.css";
import { Swiper, SwiperSlide } from "swiper/react";
import {
    Swiper as SwiperClass,
    EffectCoverflow,
    Keyboard,
    Pagination,
} from "swiper";
import "swiper/css";
import "swiper/css/keyboard";
import GameSlide from "./GameSlide";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { selectGameByIndex } from "../Transforms/selectGameByIndex";
import { launchGame } from "../Transforms/launchGame";
import { gamepadManager } from "../Services/GamepadManager";
import { getHighScores, getSelectedGameIndex } from "../State";

interface IProps {
    addButtonSelected: boolean;
    deleteButtonSelected: boolean;
}

const GameList: React.FC<IProps> = ({
    addButtonSelected,
    deleteButtonSelected,
}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const buttonSelected = addButtonSelected || deleteButtonSelected;
    const localSwiper = useRef<SwiperClass>();

    const leftKeyEvent = (eventType: string) => {
        return new KeyboardEvent(eventType, {
            key: "ArrowLeft",
            code: "ArrowLeft",
            composed: true,
            keyCode: 37,
            cancelable: true,
            view: window,
        });
    };

    const rightKeyEvent = (eventType: string) => {
        return new KeyboardEvent(eventType, {
            key: "ArrowRight",
            code: "ArrowRight",
            composed: true,
            keyCode: 39,
            cancelable: true,
            view: window,
        });
    };

    const clickItem = useCallback(() => {
        const gameId = kiosk.selectedGameId;
        if (gameId) {
            pxt.tickEvent("kiosk.gameLaunched", { game: gameId });
            playSoundEffect("select");
            launchGame(gameId);
        }
    }, [kiosk]);

    // on page load use effect
    useEffect(() => {
        if (!kiosk.selectedGameId && kiosk.allGames.length) {
            selectGameByIndex(0);
        } else {
            const gameIndex = getSelectedGameIndex();
            if (gameIndex !== undefined) {
                localSwiper.current?.slideTo(gameIndex + 2);
            }
        }
    }, [localSwiper]);

    // poll for game pad input
    useEffect(() => {
        const syncSelectedGame = () => {
            const gameIndex = localSwiper?.current?.realIndex || 0;
            const selectedGameIndex = getSelectedGameIndex();
            if (
                selectedGameIndex !== undefined &&
                gameIndex !== selectedGameIndex
            ) {
                selectGameByIndex(gameIndex);
                playSoundEffect("swipe");
            }
        };

        const updateLoop = () => {
            if (kiosk.kioskState !== KioskState.MainMenu) {
                return;
            }

            if (gamepadManager.isAButtonPressed()) {
                clickItem();
            }

            if (gamepadManager.isLeftPressed()) {
                document.dispatchEvent(leftKeyEvent("keydown"));
                document.dispatchEvent(leftKeyEvent("keyup"));
                syncSelectedGame();
            }

            if (gamepadManager.isRightPressed()) {
                document.dispatchEvent(rightKeyEvent("keydown"));
                document.dispatchEvent(rightKeyEvent("keyup"));
                syncSelectedGame();
            }
        };

        let intervalId: any = null;
        if (kiosk.allGames.length) {
            intervalId = setInterval(() => {
                if (!buttonSelected) {
                    updateLoop();
                }
            }, configData.GamepadPollLoopMilli);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [kiosk, localSwiper, buttonSelected]);

    const slideChanged = useCallback(() => {}, [localSwiper]);

    if (!kiosk.allGames?.length) {
        return (
            <div>
                <p>Currently no kiosk games</p>
            </div>
        );
    }

    return (
        <div className="carouselWrap">
            <Swiper
                effect={"coverflow"}
                loop={true}
                slidesPerView={1.5}
                centeredSlides={true}
                spaceBetween={130}
                pagination={{ type: "fraction" }}
                onSwiper={swiper => {
                    localSwiper.current = swiper;
                }}
                coverflowEffect={{
                    scale: 0.75,
                    depth: 5,
                }}
                allowTouchMove={false}
                allowSlideNext={!buttonSelected}
                allowSlidePrev={!buttonSelected}
                modules={[EffectCoverflow, Keyboard, Pagination]}
                keyboard={{ enabled: true }}
                onSlideChange={() => slideChanged()}
            >
                {kiosk.allGames.map((game, index) => {
                    const gameHighScores = getHighScores(game.id);
                    return (
                        <SwiperSlide key={index}>
                            <GameSlide
                                highScores={gameHighScores}
                                addButtonSelected={addButtonSelected}
                                deleteButtonSelected={deleteButtonSelected}
                                game={game}
                                locked={kiosk.locked}
                            />
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
};

export default GameList;
