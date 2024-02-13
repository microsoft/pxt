export async function confirmAsync(prompt: string) {
    // TODO: Replace with our own confirmation dialog.
    if (!confirm(prompt)) {
        return false;
    }
    return true;
}
