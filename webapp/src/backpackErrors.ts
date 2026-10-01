/** An expected, actionable failure with a localized message. Use Error for invalid data or internal failures. */
export class BackpackUserError extends Error {
    readonly isUserError = true;
}

export function isBackpackUserError(error: unknown): error is BackpackUserError {
    return error instanceof Error && (error as BackpackUserError).isUserError === true;
}

/** Display only explicitly marked user errors; report technical failures separately. */
export function backpackUserErrorMessage(error: unknown, fallback: string): string {
    if (isBackpackUserError(error) && error.message) {
        return error.message;
    }
    pxt.reportException(error);
    return fallback;
}
