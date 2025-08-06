import { ActionBase, ModalOptions } from "@/types";

/**
 * Actions
 */

type SetFoo = ActionBase<"SET_FOO", { foo: string }>;
type SetBar = ActionBase<"SET_BAR", { bar: number }>;

export type Action = SetFoo | SetBar;

/**
 * Action Creators
 */

export const setFoo = (foo: string): SetFoo => ({
    type: "SET_FOO",
    payload: { foo },
});

export const setBar = (bar: number): SetBar => ({
    type: "SET_BAR",
    payload: { bar },
});
