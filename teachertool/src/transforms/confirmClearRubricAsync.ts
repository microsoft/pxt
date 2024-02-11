export async function confirmClearRubricAsync() {
    // TODO: Replace with our own confirmation dialog.
    if (!confirm(lf("This will clear your current rubric. Continue?"))) {
        return false;
    }
    return true;
}
