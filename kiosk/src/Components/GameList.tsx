import React, { useEffect, useRef, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import { KioskState } from "../Models/KioskState";
import configData from "../config.json"
import "../Kiosk.css";
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Keyboard, Navigation, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/keyboard";
import GameSlide from "./GameSlide";
import { tickEvent } from "../browserUtils";
interface IProps {
    kiosk: Kiosk;
    addButtonSelected: boolean;
    deleteButtonSelected: boolean;
  }


const GameList: React.FC<IProps> = ({ kiosk, addButtonSelected, deleteButtonSelected }) => {
    const [games, setGames] = useState(kiosk.games);
    const buttonSelected = addButtonSelected || deleteButtonSelected;
    const localSwiper = useRef<any>();

    const leftKeyEvent = (eventType: string) => {
        return new KeyboardEvent(eventType, {
            "key": "ArrowLeft",
            "code": "ArrowLeft",
            "composed": true,
            "keyCode": 37,
            "cancelable": true,
            "view": window
        });
    }

    const rightKeyEvent = (eventType: string) => {
        return new KeyboardEvent(eventType, {
            "key": "ArrowRight",
            "code": "ArrowRight",
            "composed": true,
            "keyCode": 39,
            "cancelable": true,
            "view": window
        });
    }

    const getGameIndex = () => {
        let gameIndex = (localSwiper.current.activeIndex - 2) % games.length;
        if (gameIndex < 0) {
            gameIndex = games.length - 1;
        }
        return gameIndex;
    }

    const changeFocusedItem = () => {
        const gameIndex = getGameIndex();
        kiosk.selectGame(gameIndex);
    }

    const clickItem = () => {
        const localSwiperIndex = getGameIndex();
        if (localSwiperIndex !== kiosk.selectedGameIndex) {
            kiosk.selectGame(localSwiperIndex);
        }

        const gameId = kiosk.selectedGame?.id;
        if (gameId) {
            tickEvent("kiosk.gameLaunched", { game: gameId });
            kiosk.launchGame(gameId);
        }
    }
        
    const updateLoop = () => {
        if (kiosk.state !== KioskState.MainMenu) {
            return;
        }

        if (kiosk.gamepadManager.isAButtonPressed()) {
            clickItem();
        }

        if (kiosk.gamepadManager.isLeftPressed()) {
            document.dispatchEvent(leftKeyEvent("keydown"));
            document.dispatchEvent(leftKeyEvent("keyup"));
            changeFocusedItem();
        }

        if (kiosk.gamepadManager.isRightPressed()) {
            document.dispatchEvent(rightKeyEvent("keydown"));
            document.dispatchEvent(rightKeyEvent("keyup"));
            changeFocusedItem();
        }
    }

    // on page load use effect
    useEffect(() => {
        kiosk.initialize().then(() => {
            setGames(kiosk.games);

            if (!kiosk.selectedGame && kiosk.games.length) {
                kiosk.selectGame(0);
            }

            if (kiosk.selectedGameIndex) {
                localSwiper.current.slideTo(kiosk.selectedGameIndex + 2);
            }
        })
    }, []);

    // poll for game pad input
    useEffect(() => {
        let intervalId: any = null;
        if (games.length) {
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
    }, [games, buttonSelected]);

    if (!kiosk.games || !kiosk.games.length) {
        return(
        <div>
            <p>Currently no kiosk games</p>
        </div>);
    }

    return(
        <div className="carouselWrap">
            <Swiper
                effect={"coverflow"}
                loop={true}
                slidesPerView={1.5}
                centeredSlides={true}
                spaceBetween={10}
                pagination={{type: "fraction",}}
                onSwiper={(swiper) => {
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
                keyboard={{enabled: true}}
            >
                {kiosk.games.map((game, index) => {
                    const gameHighScores = kiosk.getHighScores(game.id);
                    return (
                        <SwiperSlide key={game.id}>
                            <GameSlide highScores={gameHighScores} addButtonSelected={addButtonSelected}
                                deleteButtonSelected={deleteButtonSelected} game={game} />
                        </SwiperSlide>
                    )
                })}
            </Swiper>
        </div>
    )
}
  
export default GameList;