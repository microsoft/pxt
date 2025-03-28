import * as React from "react";

interface FocusTrapState {
    regions: FocusTrapRegionState[];
}

interface FocusTrapRegionState {
    id: string;
    enabled: boolean;
    order: number;
    onEscape?: () => void;
}

const FocustTrapStateContext = React.createContext<FocusTrapState>(null);
const FocustTrapDispatchContext = React.createContext<(action: Action) => void>(null);

export const FocusTrapProvider = ({
    children,
}: React.PropsWithChildren<{}>) => {
    const [state, dispatch] = React.useReducer(focusTrapReducer, {
        regions: []
    });

    return (
        <FocustTrapStateContext.Provider value={state}>
            <FocustTrapDispatchContext.Provider value={dispatch}>
                {children}
            </FocustTrapDispatchContext.Provider>
        </FocustTrapStateContext.Provider>
    );
}

type AddRegion = {
    type: "ADD_REGION";
    id: string;
    order: number;
    enabled: boolean;
    onEscape?: () => void;
};

type RemoveRegion = {
    type: "REMOVE_REGION";
    id: string;
};

type Action = AddRegion | RemoveRegion;

export const addRegion = (id: string, order: number, enabled: boolean, onEscape?: () => void): AddRegion => (
    {
        type: "ADD_REGION",
        id,
        order,
        enabled,
        onEscape
    }
);

export const removeRegion = (id: string): RemoveRegion => (
    {
        type: "REMOVE_REGION",
        id
    }
);

export function useFocusTrapState() {
    return React.useContext(FocustTrapStateContext);
}

export function useFocusTrapDispatch() {
    return React.useContext(FocustTrapDispatchContext);
}

function focusTrapReducer(state: FocusTrapState, action: Action): FocusTrapState {
    let newRegions = state.regions.slice();

    switch (action.type) {
        case "ADD_REGION":
            const newRegion = {
                id: action.id,
                enabled: action.enabled,
                order: action.order,
                onEscape: action.onEscape
            };
            const existing = newRegions.findIndex(r => r.id === action.id);
            if (existing !== -1) {
                newRegions.splice(existing, 1, newRegion)
            }
            else {
                newRegions.push(newRegion);
            }
            break;
        case "REMOVE_REGION":
            const toRemove = state.regions.findIndex(r => r.id === action.id);
            if (toRemove !== -1) {
                newRegions.splice(toRemove, 1)
            }
            break;
    }

    return {
        regions: newRegions
    };
}
