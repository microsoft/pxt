export function fireClickOnEnter(e: React.KeyboardEvent<HTMLElement>): void {
    const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
    if (charCode === /*enter*/13 || charCode === /*space*/32) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
    }
}