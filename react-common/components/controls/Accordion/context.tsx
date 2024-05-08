import * as React from "react";

interface AccordionState {
    multiExpand?: boolean;
    expanded: string[];
}

const AccordionStateContext = React.createContext<AccordionState>(null);
const AccordionDispatchContext = React.createContext<(action: Action) => void>(null);

export const AccordionProvider = ({
    multiExpand,
    defaultExpandedIds,
    children,
}: React.PropsWithChildren<{ multiExpand?: boolean; defaultExpandedIds?: string[] }>) => {
    const [state, dispatch] = React.useReducer(accordionReducer, {
        expanded: defaultExpandedIds ?? [],
        multiExpand,
    });

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

type RemoveExpanded = {
    type: "REMOVE_EXPANDED";
    id: string;
};

type Action = SetExpanded | RemoveExpanded;

export const setExpanded = (id: string): SetExpanded => (
    {
        type: "SET_EXPANDED",
        id
    }
);

export const removeExpanded = (id: string): RemoveExpanded => (
    {
        type: "REMOVE_EXPANDED",
        id
    }
);

export function useAccordionState() {
    return React.useContext(AccordionStateContext);
}

export function useAccordionDispatch() {
    return React.useContext(AccordionDispatchContext);
}

function accordionReducer(state: AccordionState, action: Action): AccordionState {
    switch (action.type) {
        case "SET_EXPANDED":
            return {
                ...state,
                expanded: state.multiExpand ? [...state.expanded, action.id] : [action.id],
            };
        case "REMOVE_EXPANDED":
            return {
                ...state,
                expanded: state.expanded.filter((id) => id !== action.id),
            };
    }
}
