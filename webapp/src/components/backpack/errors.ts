/** A localized message safe to show to the user. Use Error for technical failures. */
export class BackpackUserError extends Error {
    readonly isUserError = true;
}

export function isBackpackUserError(error: unknown): error is BackpackUserError {
    return error instanceof Error && (error as BackpackUserError).isUserError === true;
}

/** Report technical errors without exposing their messages to the user. */
export function backpackUserErrorMessage(error: unknown, fallback: string): string {
    if (isBackpackUserError(error) && error.message) {
        return error.message;
    }
    pxt.reportException(error);
    return fallback;
}
