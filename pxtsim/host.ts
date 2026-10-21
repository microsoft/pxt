// Host abstraction: everything the DOM-free simulator core needs to know about the
// environment it runs in. The DOM bundle installs a browser implementation
// (see domhost.ts); without one the core runs with inert defaults.
namespace pxsim.host {
    export interface Environment {
        /** Delivers a message to the parent (editor) window, if any. */
        postToParent(data: SimulatorMessage): void;
        /** The current page URL, or undefined when there is no page. */
        locationHref(): string | undefined;
        isPxtElectron(): boolean;
        isIpcRenderer(): boolean;
        /** Id of the simulator frame hosting this runtime, if any. */
        frameId(): string | undefined;
    }

    const defaultEnvironment: Environment = {
        postToParent: () => { },
        locationHref: () => undefined,
        isPxtElectron: () => false,
        isIpcRenderer: () => false,
        frameId: () => undefined
    };

    let current: Environment = defaultEnvironment;

    export function environment(): Environment {
        return current;
    }

    /** Overrides parts of the environment; omitted members keep their defaults. */
    export function setEnvironment(env: Partial<Environment>) {
        current = { ...defaultEnvironment, ...env };
    }
}
