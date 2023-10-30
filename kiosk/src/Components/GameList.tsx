import React, { useEffect, useState, useContext, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperClass, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/keyboard";
import GameSlide from "./GameSlide";
import { playSoundEffect } from "../Services/SoundEffectService";
import { AppStateContext } from "../State/AppStateContext";
import { selectGameByIndex } from "../Transforms/selectGameByIndex";
import { launchGame } from "../Transforms/launchGame";
import { getSelectedGameIndex, getSelectedGameId } from "../State";
import * as GamepadManager from "../Services/GamepadManager";
import * as NavGrid from "../Services/NavGrid";
import { useOnControlPress, useMakeNavigable } from "../Hooks";

interface IProps {}

const GameList: React.FC<IProps> = ({}) => {
    const { state: kiosk } = useContext(AppStateContext);
    const [localSwiper, setLocalSwiper] = useState<SwiperClass | undefined>(
        undefined
    );
    const [userInitiatedTransition, setUserInitiatedTransition] =
        React.useState(false);
    const [pageInited, setPageInited] = React.useState(false);
    const [generation, setGeneration] = React.useState(0);

    const handleLocalSwiper = (swiper: SwiperClass) => {
        setLocalSwiper(swiper);
    };

    useMakeNavigable(localSwiper?.el, {
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
        if (!localSwiper || localSwiper.destroyed) return;
        const gameIndex = localSwiper.realIndex || 0;
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
        if (!localSwiper || localSwiper.destroyed) return;
        if (!pageInited) {
            if (kiosk.allGames.length) {
                if (!kiosk.selectedGameId) {
                    selectGameByIndex(0);
                    localSwiper.slideTo(2);
                } else {
                    const index = getSelectedGameIndex() || 0;
                    localSwiper.slideTo(index + 2);
                }
                setPageInited(true);
            }
        }
    }, [pageInited, localSwiper, kiosk]);

    // Handle DPadRight button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (!localSwiper || localSwiper.destroyed) return;
            if (NavGrid.isActiveElement(localSwiper.el)) {
                setUserInitiatedTransition(true);
                setTimeout(() => localSwiper.slideNext(), 1);
            }
        },
        GamepadManager.GamepadControl.DPadRight
    );

    // Handle DPadLeft button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (!localSwiper || localSwiper.destroyed) return;
            if (NavGrid.isActiveElement(localSwiper.el)) {
                setUserInitiatedTransition(true);
                setTimeout(() => localSwiper?.slidePrev(), 1);
            }
        },
        GamepadManager.GamepadControl.DPadLeft
    );

    // Handle A button press
    useOnControlPress(
        [localSwiper, userInitiatedTransition],
        () => {
            if (!localSwiper || localSwiper.destroyed) return;
            if (NavGrid.isActiveElement(localSwiper.el)) {
                launchSelectedGame();
            }
        },
        GamepadManager.GamepadControl.AButton
    );

    const slideChangeTransitionStart = () => {
        if (userInitiatedTransition) {
            playSoundEffect("swipe");
        }
    };

    const slideChangeTransitionEnd = () => {
        setGeneration(generation + 1); // This will force GameSlides to re-render
        if (userInitiatedTransition) {
            syncSelectedGame();
            setUserInitiatedTransition(false);
        }
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
                tabIndex={0}
                loop={true}
                slidesPerView={1.8}
                centeredSlides={true}
                pagination={{ type: "fraction" }}
                onSwiper={handleLocalSwiper}
                allowTouchMove={true}
                modules={[Pagination]}
                onSlideChangeTransitionStart={() =>
                    slideChangeTransitionStart()
                }
                onSlideChangeTransitionEnd={() => slideChangeTransitionEnd()}
                onTouchStart={() => setUserInitiatedTransition(true)}
            >
                {kiosk.allGames.map((game, index) => {
                    return (
                        <SwiperSlide key={index}>
                            <GameSlide game={game} generation={generation} />
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
};

export default GameList;
