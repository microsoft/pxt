export const MAX_PROJECT_NOTE_LENGTH = 4096;
export const MAX_WHITEBOARD_DIMENSION = 256;
export const WHITEBOARD_WIDTH = 160;
export const WHITEBOARD_HEIGHT = 120;

/** A separate boundary from cloud sync: notes are private, not local-only. */
export function excludePrivateProjectMetadata(header: pxt.workspace.Header): pxt.workspace.Header {
    const shared = { ...header };
    delete shared.projectNotes;
    return shared;
}

export function decodeWhiteboard(image: string): pxt.sprite.Bitmap {
    if (!image || image.length > 45000 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(image))
        throw new Error("Invalid whiteboard image");
    const bytes = atob(image);
    // Validate before the bitmap decoder allocates from the supplied dimensions.
    const modern = bytes.charCodeAt(0) === 0x87 && bytes.charCodeAt(1) === 4;
    const legacy = bytes.charCodeAt(0) === 0xe4;
    const width = modern ? bytes.charCodeAt(2) | (bytes.charCodeAt(3) << 8) : bytes.charCodeAt(1);
    const height = modern ? bytes.charCodeAt(4) | (bytes.charCodeAt(5) << 8) : bytes.charCodeAt(2);
    const length = (modern ? 8 : 4) + width * ((Math.ceil(height / 2) + 3) & ~3);
    if ((!modern && !legacy) || !width || !height || width > MAX_WHITEBOARD_DIMENSION ||
        height > MAX_WHITEBOARD_DIMENSION || bytes.length !== length)
        throw new Error("Invalid whiteboard dimensions or image data");
    return pxt.sprite.getBitmapFromJResURL(image);
}

export function validateProjectNotes(notes: pxt.workspace.ProjectNotes): pxt.workspace.ProjectNotes {
    if (!notes || notes.version !== 1 || typeof notes.text !== "string" || notes.text.length > MAX_PROJECT_NOTE_LENGTH)
        throw new Error("Invalid project notes");
    if (notes.image) decodeWhiteboard(notes.image);
    if (notes.palette && (notes.palette.length !== 16 || notes.palette.some(color => !/^#[0-9a-f]{6}$/i.test(color))))
        throw new Error("Invalid whiteboard palette");
    return { version: 1, text: notes.text, image: notes.image, palette: notes.palette?.slice() };
}