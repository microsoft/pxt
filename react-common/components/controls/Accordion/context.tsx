import * as React from "react";

interface AccordionState {
    expanded?: string;
}

const AccordionStateContext = React.createContext<AccordionState>(null);
const AccordionDispatchContext = React.createContext<(action: Action) => void>(null);

export const AccordionProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const [state, dispatch] = React.useReducer(
        accordionReducer,
        {}
    );

    return (
        <AccordionStateContext.Provider value={state}>
            <AccordionDispatchContext.Provider value={dispatch}>
                {children}
            </AccordionDispatchContext.Provider>
        </AccordionStateContext.Provider>
    )
}

type SetExpanded = {
    type: "SET_EXPANDED";
    id: string;
};

type ClearExpanded = {
    type: "CLEAR_EXPANDED";
};

type Action = SetExpanded | ClearExpanded;

export const setExpanded = (id: string): SetExpanded => (
    {
        type: "SET_EXPANDED",
        id
    }
);

export const clearExpanded = (): ClearExpanded => (
    {
        type: "CLEAR_EXPANDED"
    }
);

export function useAccordionState() {
    return React.useContext(AccordionStateContext)
}

export function useAccordionDispatch() {
    return React.useContext(AccordionDispatchContext);
}

function accordionReducer(state: AccordionState, action: Action): AccordionState {
    switch (action.type) {
        case "SET_EXPANDED":
            return {
                ...state,
                expanded: action.id
            };
        case "CLEAR_EXPANDED":
            return {
                ...state,
                expanded: undefined
            };
    }
}