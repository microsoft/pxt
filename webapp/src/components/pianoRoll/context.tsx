import { createContext, useContext, useEffect, useReducer, useRef } from "react";

export interface PianoRollTheme {
    octaveWidth: number;
    whiteKeyHeight: number;
    measures: number;
    minOctave: number;
    maxOctave: number;
    gridLineColor: string;
    whiteKeyWorkspaceColor: string;
    blackKeyWorkspaceColor: string;
}

const defaultTheme: PianoRollTheme = {
    octaveWidth: 500,
    whiteKeyHeight: 40,
    measures: 4,
    minOctave: 3,
    maxOctave: 5,
    gridLineColor: "#283547",
    whiteKeyWorkspaceColor: "#405470",
    blackKeyWorkspaceColor: "#36475f"
};

interface ThemeAndUpdate {
    state: PianoRollTheme;
    dispatch: (newTheme: Partial<PianoRollTheme>) => void;
}

export const PianoRollContext = createContext<ThemeAndUpdate>({
    state: undefined!,
    dispatch: undefined!
});

function reducer(state: PianoRollTheme, newTheme: Partial<PianoRollTheme>): PianoRollTheme {
    return { ...state, ...newTheme };
}

export function PianoRollThemeProvider(
    props: React.PropsWithChildren<{}>
): React.ReactElement {
    const [state, dispatch] = useReducer(reducer, defaultTheme);

    const value = { state, dispatch };
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        rootRef.current!.setAttribute("style", `--octave-width: ${value.state.octaveWidth}px; --white-key-height: ${value.state.whiteKeyHeight}px;`);
        const style = getComputedStyle(rootRef.current!);

        const gridLineColor = style.getPropertyValue("--workspace-grid-line-color");
        const whiteKeyWorkspaceColor = style.getPropertyValue("--workspace-white-key-color");
        const blackKeyWorkspaceColor = style.getPropertyValue("--workspace-black-key-color");

        if (
            gridLineColor !== value.state.gridLineColor ||
            whiteKeyWorkspaceColor !== value.state.whiteKeyWorkspaceColor ||
            blackKeyWorkspaceColor !== value.state.blackKeyWorkspaceColor
        ) {
            dispatch({
                gridLineColor,
                whiteKeyWorkspaceColor,
                blackKeyWorkspaceColor
            });
        }
    }, [])

    return (
        <PianoRollContext.Provider
            value={value}
        >
            <div className="piano-roll-root" ref={rootRef}>
                {props.children}
            </div>
        </PianoRollContext.Provider>
    );
}

export function usePianoRollTheme() {
    return useContext(PianoRollContext).state;
}

export function usePianoRollThemeContext() {
    return useContext(PianoRollContext);
}