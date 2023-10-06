import React, { useEffect, useRef, useContext, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperClass, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/keyboard";
import GameSlide from "./GameSlide";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { selectGameByIndex } from "../Transforms/selectGameByIndex";
import { launchGame } from "../Transforms/launchGame";
import {
    getHighScores,
    getSelectedGameIndex,
    getSelectedGameId,
} from "../State";
import * as GamepadManager from "../Services/GamepadManager";
import * as NavGrid from "../Services/NavGrid";
import { useOnControlPress, useMakeNavigable } from "../Hooks";

interface IProps {}

const GameList: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const localSwiper = useRef<SwiperClass>();
    const [userInitiatedTransition, setUserInitiatedTransition] =
        React.useState(false);
    const [pageInited, setPageInited] = React.useState(false);

    useMakeNavigable(localSwiper?.current?.el, {
        exitDirections: [NavGrid.NavDirection.Down, NavGrid.NavDirection.Up],
        autofocus: true,
    });

    const launchSelectedGame = () => {
        const gameId = getSelectedGameId();
        if (gameId) {
            pxt.tickEvent("kiosk.gameLaunched", { game: gameId });
            playSoundEffect("select");
            launchGame(gameId);
        }
    };

    const syncSelectedGame = useCallback(() => {
        const gameIndex = localSwiper?.current?.realIndex || 0;
        const selectedGameIndex = getSelectedGameIndex();
        if (
            selectedGameIndex !== undefined &&
            gameIndex !== selectedGameIndex
        ) {
            selectGameByIndex(gameIndex);
        }
    }, [localSwiper]);

    // on page load use effect
    useEffect(() => {
        if (!pageInited) {
            if (kiosk.allGames.length) {
                if (!kiosk.selectedGameId) {
                    selectGameByIndex(0);
                    localSwiper.current?.slideTo(2);
                } else {
                    const index = getSelectedGameIndex() || 0;
                    localSwiper.current?.slideTo(index + 2);
                }
                setPageInited(true);
            }
        }
    }, [pageInited, localSwiper, kiosk]);

    // Handle DPadRight button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (NavGrid.isActiveElement(localSwiper?.current?.el)) {
                setUserInitiatedTransition(true);
                setTimeout(() => localSwiper.current?.slideNext(), 1);
            }
        },
        GamepadManager.GamepadControl.DPadRight
    );

    // Handle DPadLeft button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (NavGrid.isActiveElement(localSwiper?.current?.el)) {
                setUserInitiatedTransition(true);
                setTimeout(() => localSwiper.current?.slidePrev(), 1);
            }
        },
        GamepadManager.GamepadControl.DPadLeft
    );

    // Handle A button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (NavGrid.isActiveElement(localSwiper?.current?.el)) {
                launchSelectedGame();
            }
        },
        GamepadManager.GamepadControl.AButton,
        GamepadManager.GamepadControl.BButton
    );

    const transitionStart = () => {
        if (userInitiatedTransition) {
            syncSelectedGame();
            playSoundEffect("swipe");
            setUserInitiatedTransition(false);
        }
    };

    const onTouchEnd = () => {
        syncSelectedGame();
    };

    if (!kiosk.allGames?.length) {
        return (
            <div>
                <p>{lf("Currently no kiosk games")}</p>
            </div>
        );
    }

    return (
        <div className="carouselWrap">
            <Swiper
                focusableElements="div"
                slideActiveClass="swiper-slide-active"
                tabIndex={0}
                loop={true}
                slidesPerView={1.8}
                centeredSlides={true}
                pagination={{ type: "fraction" }}
                onSwiper={swiper => {
                    localSwiper.current = swiper;
                }}
                allowTouchMove={true}
                modules={[Pagination]}
                onSlideChangeTransitionStart={() => transitionStart()}
                onTouchEnd={() => onTouchEnd()}
            >
                {kiosk.allGames.map((game, index) => {
                    const gameHighScores = getHighScores(game.id);
                    return (
                        <SwiperSlide key={index}>
                            <GameSlide
                                highScores={gameHighScores}
                                game={game}
                            />
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
};

export default GameList;
