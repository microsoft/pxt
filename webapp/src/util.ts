export function fireClickOnEnter(e: React.KeyboardEvent<HTMLElement>): void {
    const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
    if (charCode === /*enter*/13 || charCode === /*space*/32) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
    }
}

// Used to ensure repeated messages are announced by the pxt live region.
let zeroWidthSpace = false;
export function ariaAnnounce(msg: string, assertiveness?: string, role?: string) {
    const liveRegion = document.getElementById("pxt-aria-live");
    if (liveRegion && msg) {
        liveRegion.textContent = `${msg}${zeroWidthSpace ? '\u200B': ''}`;
        zeroWidthSpace = !zeroWidthSpace;
        liveRegion.ariaLive = assertiveness ?? "polite";
        liveRegion.setAttribute("role", role ?? null);
    }
}