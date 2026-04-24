import { createContext, useContext, useReducer } from "react";

export interface PianoRollTheme {
    octaveWidth: number;
    whiteKeyHeight: number;
    measures: number;
    minOctave: number;
    maxOctave: number;
}

const defaultTheme: PianoRollTheme = {
    octaveWidth: 500,
    whiteKeyHeight: 40,
    measures: 4,
    minOctave: 3,
    maxOctave: 5
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

    const handleRootRef = (el: HTMLDivElement | null) => {
        if (el) {
            el.setAttribute("style", `--octave-width: ${value.state.octaveWidth}px; --white-key-height: ${value.state.whiteKeyHeight}px;`);
        }
    }

    return (
        <PianoRollContext.Provider
            value={value}
        >
            <div className="piano-roll-root" ref={handleRootRef}>
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