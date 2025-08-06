
export type AppState = {
    foo: string;
    bar: number;
    opts: Map<string, string>;
}

export const initialAppState: AppState = {
    foo: "",
    bar: 0,
    opts: new Map<string, string>(),
};
