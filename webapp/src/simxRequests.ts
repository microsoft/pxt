/**
 * A request a simulator extension host refuses or fails, with the stable code
 * its error reply carries.
 * @typeParam C the error codes of the request's message family
 */
export class SimxRequestError<C extends string = string> extends Error {
    constructor(public readonly code: C, message: string) {
        super(message);
    }
}

/** A reply of the message family `R` without the `type` and `id` fields every reply carries. */
export type SimxReplyBody<R> = R extends unknown ? Omit<R, "type" | "id"> : never;

/** Returns the `id` of the request `msg`, as received: its `id` field if that is a string, else undefined. */
export function requestId(msg: unknown): string | undefined {
    const id = (msg as { id?: unknown })?.id;
    return typeof id === "string" ? id : undefined;
}

/**
 * Returns the error reply of the message family `type` to the request with
 * the given id.
 * @param id the request's id, as {@link requestId} reads it
 */
export function errorReply<T extends string, C extends string>(type: T, id: string | undefined, code: C, message: string): { type: T, id: string | undefined, subtype: "error", code: C, message: string } {
    return { type, id, subtype: "error", code, message };
}

/**
 * Returns the error reply of the message family `type` to the request with
 * the given id whose handling threw `e`: with the code and message of a
 * {@link SimxRequestError}, else with `FAILED` and the message `e` carries.
 * @param id the request's id, as {@link requestId} reads it
 */
export function caughtErrorReply<T extends string, C extends string>(type: T, id: string | undefined, e: unknown): { type: T, id: string | undefined, subtype: "error", code: C | "FAILED", message: string } {
    return e instanceof SimxRequestError
        ? errorReply(type, id, e.code as C, e.message)
        : errorReply(type, id, "FAILED", (e as Error)?.message || String(e));
}

/**
 * Returns the GitHub repository that a simulator extension's registration
 * key names, `owner/repo` in lower case, whatever subfolder the key adds;
 * undefined if the key names no repository.
 * @param key the registration key, e.g. `owner/repo` or `Owner/Repo/sub`
 */
export function getSimxRepository(key: string): string | undefined {
    return pxt.github.parseRepoId(key)?.slug.toLowerCase();
}

/**
 * Returns `project`, the project open when a request arrived, if it is still
 * the open project.
 * @param getOpen returns the open project now, or undefined if none is open
 * @throws a `PROJECT_CLOSED` {@link SimxRequestError} if `project` is
 * undefined or is no longer the open project
 */
export function openProjectOrThrow<T>(project: T | undefined, getOpen: () => T | undefined): T {
    if (project === undefined)
        throw new SimxRequestError("PROJECT_CLOSED", "No project was open when the request arrived.");
    if (getOpen() !== project)
        throw new SimxRequestError("PROJECT_CLOSED", "The project open when the request arrived has closed.");
    return project;
}

/**
 * Waits for `project`, the project open when a request arrived, to load, and
 * returns it if it is still the open project.
 * @param getOpen returns the open project now, or undefined if none is open
 * @throws a `PROJECT_CLOSED` {@link SimxRequestError} if `project` is
 * undefined, fails to load, or is no longer the open project once it has loaded
 */
export async function loadedOpenProjectAsync<T extends { loadedAsync(): Promise<void> }>(project: T | undefined, getOpen: () => T | undefined): Promise<T> {
    if (project !== undefined) {
        try {
            await project.loadedAsync();
        } catch (e) {
            throw new SimxRequestError("PROJECT_CLOSED", "The project open when the request arrived failed to load.");
        }
    }
    return openProjectOrThrow(project, getOpen);
}

/**
 * The open project as the simulator extension hosts read it: the project the
 * editor has loaded, until it closes. A closed project reads as no project
 * until the editor loads another, which is always a new object.
 */
export class OpenProjectTracker<T> {
    // the project closed last
    protected closed: T | undefined;

    /** @param getLoaded returns the project the editor has loaded, or undefined if none is */
    constructor(protected readonly getLoaded: () => T | undefined) {
    }

    /** Returns the open project, or undefined if none is open. */
    get(): T | undefined {
        const project = this.getLoaded();
        return project !== undefined && project !== this.closed ? project : undefined;
    }

    /** Closes the open project: {@link get} returns undefined until the editor loads another. */
    close() {
        this.closed = this.getLoaded();
    }
}
