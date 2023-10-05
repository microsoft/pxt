import {
    useEffect,
    useContext,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { AppStateContext } from "../State/AppStateContext";
import { KioskState } from "../Types";

const Background = () => {
    const { state: kiosk } = useContext(AppStateContext);
    const [myRef, setMyRef] = useState<HTMLElement | null>(null);

    const canvas = useRef<HTMLCanvasElement>(document.createElement("canvas"));
    const image = useRef<HTMLImageElement>(document.createElement("img"));
    const timer = useRef<NodeJS.Timeout | null>(null);
    // TODO: Store cached background URLs in local storage instead of in memory.
    const dataUrlCache = useRef<Map<string, string>>(new Map());

    const selectedGame = useMemo(
        () => kiosk.allGames.find(g => g.id === kiosk.selectedGameId),
        [kiosk.selectedGameId]
    );

    const handleRef = useCallback((node: HTMLElement | null) => {
        setMyRef(node);
    }, []);

    useEffect(() => {
        // debounce so we don't update when continuously scrolling games
        if (timer.current) {
            clearTimeout(timer.current);
        }

        if (kiosk.kioskState === KioskState.PlayingGame) {
            if (myRef) {
                myRef.style.backgroundImage = "";
            }
            return;
        }

        timer.current = setTimeout(() => {
            if (selectedGame && kiosk.kioskState !== KioskState.PlayingGame) {
                if (dataUrlCache.current.has(selectedGame.id)) {
                    if (myRef) {
                        myRef.style.backgroundImage = `url(${dataUrlCache.current.get(
                            selectedGame.id
                        )})`;
                    }
                    return;
                }
                image.current.crossOrigin = "anonymous";
                image.current.src = `https://makecode.com/api/${selectedGame.id}/thumb`;
                image.current.onload = () => {
                    canvas.current.width = 80;
                    canvas.current.height = 60;
                    const ctx = canvas.current.getContext("2d");
                    if (ctx) {
                        // TODO: Apply blur and opacity filters to image here, not in CSS
                        ctx.drawImage(
                            image.current,
                            0,
                            0,
                            image.current.width,
                            image.current.height,
                            0,
                            0,
                            canvas.current.width,
                            canvas.current.height
                        );
                        const url = canvas.current.toDataURL("image/png");
                        if (myRef) {
                            dataUrlCache.current.set(selectedGame.id, url);
                            myRef.style.backgroundImage = `url(${url})`;
                        }
                    }
                };
            } else {
                if (myRef) {
                    myRef.style.backgroundImage = "";
                }
            }
        }, 750);
    }, [selectedGame, kiosk.kioskState, myRef]);

    const className = useMemo(() => {
        if (kiosk.kioskState === KioskState.PlayingGame) {
            return "background-flat";
        } else {
            return "background-acrylic";
        }
    }, [kiosk.kioskState]);

    return <div className={className} ref={handleRef} />;
};

export default Background;
