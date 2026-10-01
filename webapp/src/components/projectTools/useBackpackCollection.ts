import * as React from "react";
import * as auth from "../../auth";
import * as backpack from "../../backpack";
import { backpackUserErrorMessage } from "../../backpackErrors";
import { useBackpackPageFocus } from "./useBackpackPageFocus";

interface BackpackOperationError {
    message: string;
    entryKey?: string;
}

interface BackpackCollectionOptions {
    userId?: string;
    active: boolean;
    paused: boolean;
    onRefresh: () => void;
    onPageReturn: () => void;
}

interface BackpackCollection {
    state: backpack.BackpackState;
    ready: boolean;
    pending: boolean;
    loading: boolean;
    error?: BackpackOperationError;
    isCurrent: () => boolean;
    isBusy: () => boolean;
    runAsync: (action: () => Promise<void>, errorKey?: string) => Promise<void>;
    refreshAsync: () => Promise<void>;
    reload: () => backpack.BackpackState;
    showError: (message?: string, entryKey?: string) => void;
}

export function getBackpackUserId(): string | undefined {
    return auth.hasIdentity() && auth.loggedIn() ? auth.userProfile()?.id : undefined;
}

export function useBackpackCollection(options: BackpackCollectionOptions): BackpackCollection {
    const { userId, active, paused } = options;
    const [state, setState] = React.useState<backpack.BackpackState>({ entries: [] });
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<BackpackOperationError>();
    const [, update] = React.useReducer((value: number) => value + 1, 0);

    const alive = React.useRef(true);
    const busy = React.useRef(false);
    const loaded = React.useRef(false);
    const fullRefresh = React.useRef(true);
    const refreshQueued = React.useRef(true);
    const refreshGeneration = React.useRef(0);
    const targetId = React.useRef(pxt.appTarget?.id);
    const callbacks = React.useRef(options);
    callbacks.current = options;

    const isCurrent = (): boolean => alive.current
        && getBackpackUserId() === userId
        && pxt.appTarget?.id === targetId.current;

    const showError = (message?: string, entryKey?: string): void => {
        setError(message === undefined ? undefined : { message, entryKey });
    };

    const reportError = (reason: unknown, entryKey?: string): void => {
        showError(
            backpackUserErrorMessage(reason, lf("Could not update your backpack. Please try again.")),
            entryKey
        );
    };

    const reload = (): backpack.BackpackState => {
        const contents = backpack.getBackpackState();
        setState(contents);
        return contents;
    };

    React.useEffect(() => {
        alive.current = true;
        const unsubscribe = backpack.subscribeBackpack(() => {
            if (!isCurrent()) return;
            update(); // Also observes editor eligibility and installed extensions.
            if (!loaded.current) return;

            try {
                reload();
            } catch (reason) {
                setState({ entries: [] });
                loaded.current = false;
                setReady(false);
                reportError(reason);
            }
        });

        return () => {
            alive.current = false;
            unsubscribe();
        };
    }, []);

    const runAsync = async (action: () => Promise<void>, errorKey?: string): Promise<void> => {
        if (busy.current || !isCurrent()) return;
        busy.current = true;
        setPending(true);
        setError(undefined);

        try {
            await action();
        } catch (reason) {
            if (isCurrent()) reportError(reason, errorKey);
        } finally {
            if (isCurrent()) {
                busy.current = false;
                setPending(false);
            }
        }
    };

    const refreshAsync = (): Promise<void> => runAsync(async () => {
        refreshQueued.current = false;
        const generation = refreshGeneration.current;
        const force = fullRefresh.current;
        const previous = force ? { entries: [] } : backpack.getBackpackState();
        loaded.current = !!previous.complete || !!previous.entries.length;
        setReady(!!previous.complete);
        setState(previous);
        callbacks.current.onRefresh();

        try {
            await backpack.refreshBackpackAsync();
        } catch (reason) {
            if (generation !== refreshGeneration.current) return;
            if (isCurrent()) {
                const contents = backpack.getBackpackState();
                // Do not restore cached cards after a project switch or a return to the page.
                setState(!force && contents.complete === false ? contents : { entries: [] });
                setReady(false);
                loaded.current = !force;
            }
            throw reason;
        }
        if (!isCurrent() || generation !== refreshGeneration.current) return;

        reload();
        loaded.current = true;
        fullRefresh.current = false;
        setReady(true);
    });

    React.useLayoutEffect(() => {
        if (active) refreshQueued.current = true;
    }, [active]);

    useBackpackPageFocus(isCurrent, () => {
        fullRefresh.current = true;
        refreshQueued.current = true;
        refreshGeneration.current++;
        loaded.current = false;
        callbacks.current.onPageReturn();
        setState({ entries: [] });
        setReady(false);
    });

    React.useLayoutEffect(() => {
        // Wait for item operations and dialogs before applying a queued refresh.
        if (active && !document.hidden && !busy.current && !paused && refreshQueued.current) {
            void refreshAsync();
        }
    });

    return {
        state,
        ready,
        pending,
        loading: !loaded.current && pending && active,
        error,
        isCurrent,
        isBusy: () => busy.current,
        runAsync,
        refreshAsync,
        reload,
        showError
    };
}
