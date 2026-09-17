export const MAX_PROJECT_NOTE_LENGTH = 4096;
export const MAX_PROJECT_WHITEBOARDS = 8;
export const MAX_WHITEBOARD_NAME_LENGTH = 64;
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
    if (typeof image !== "string" || !image || image.length > 45000 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(image))
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

function validateContent(notes: pxt.workspace.WhiteboardContent): pxt.workspace.WhiteboardContent {
    if (!notes || typeof notes.text !== "string" || notes.text.length > MAX_PROJECT_NOTE_LENGTH)
        throw new Error("Invalid project notes");
    if (notes.image !== undefined && typeof notes.image !== "string") throw new Error("Invalid whiteboard image");
    if (notes.image) decodeWhiteboard(notes.image);
    if (notes.palette !== undefined && (!Array.isArray(notes.palette) || notes.palette.length !== 16 ||
        notes.palette.some(color => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))))
        throw new Error("Invalid whiteboard palette");
    return { text: notes.text, image: notes.image, palette: notes.palette?.slice() };
}

export function validateProjectNotes(notes: pxt.workspace.ProjectNotes): pxt.workspace.ProjectNotes {
    if (!notes || !Array.isArray(notes.whiteboards) || !notes.whiteboards.length ||
        notes.whiteboards.length > MAX_PROJECT_WHITEBOARDS) throw new Error("Invalid project whiteboards");
    const ids = new Set<string>();
    const names = new Set<string>();
    const whiteboards = notes.whiteboards.map(board => {
        if (!board || typeof board.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(board.id) || ids.has(board.id) ||
            typeof board.name !== "string" || !board.name.trim() || board.name.length > MAX_WHITEBOARD_NAME_LENGTH ||
            /[\r\n\t]/.test(board.name) || names.has(board.name.trim().toLowerCase())) throw new Error("Invalid whiteboard name or ID");
        ids.add(board.id);
        names.add(board.name.trim().toLowerCase());
        return { id: board.id, name: board.name.trim(), ...validateContent(board) };
    });
    if (!ids.has(notes.activeWhiteboardId)) throw new Error("Invalid active whiteboard");
    return { whiteboards, activeWhiteboardId: notes.activeWhiteboardId };
}

/** Create the first whiteboard for a project without saved notes. */
export function createProjectNotes(): pxt.workspace.ProjectNotes {
    const board: pxt.workspace.ProjectWhiteboard = {
        id: "whiteboard-1", name: pxt.Util.lf("Whiteboard {0}", 1), text: ""
    };
    return { whiteboards: [board], activeWhiteboardId: board.id };
}

export function whiteboardNameError(name: string, notes: pxt.workspace.ProjectNotes, exceptId?: string): string {
    const trimmed = name.trim();
    if (!trimmed) return pxt.Util.lf("Enter a whiteboard name.");
    if (trimmed.length > MAX_WHITEBOARD_NAME_LENGTH || /[\r\n\t]/.test(trimmed))
        return pxt.Util.lf("Use a single-line name of {0} characters or fewer.", MAX_WHITEBOARD_NAME_LENGTH);
    if (notes.whiteboards.some(board => board.id !== exceptId && board.name.toLowerCase() === trimmed.toLowerCase()))
        return pxt.Util.lf("A whiteboard with this name already exists.");
    return undefined;
}

export function nextWhiteboardName(notes: pxt.workspace.ProjectNotes): string {
    let index = 1;
    while (notes.whiteboards.some(board => board.name.toLowerCase() === pxt.Util.lf("Whiteboard {0}", index).toLowerCase())) ++index;
    return pxt.Util.lf("Whiteboard {0}", index);
}

export function addProjectWhiteboard(notes: pxt.workspace.ProjectNotes, name: string): pxt.workspace.ProjectNotes {
    const error = whiteboardNameError(name, notes);
    if (error) throw new Error(error);
    if (notes.whiteboards.length >= MAX_PROJECT_WHITEBOARDS) throw new Error(pxt.Util.lf("You can have up to {0} whiteboards per project.", MAX_PROJECT_WHITEBOARDS));
    const board: pxt.workspace.ProjectWhiteboard = { id: pxt.Util.guidGen(), name: name.trim(), text: "" };
    return { ...notes, whiteboards: [...notes.whiteboards, board], activeWhiteboardId: board.id };
}

export function renameProjectWhiteboard(notes: pxt.workspace.ProjectNotes, id: string, name: string): pxt.workspace.ProjectNotes {
    const error = whiteboardNameError(name, notes, id);
    if (error) throw new Error(error);
    if (!notes.whiteboards.some(board => board.id === id)) throw new Error("Unknown whiteboard");
    return { ...notes, whiteboards: notes.whiteboards.map(board => board.id === id ? { ...board, name: name.trim() } : board) };
}

/** Remove a confirmed board while keeping at least one board and a valid selection. */
export function deleteProjectWhiteboard(notes: pxt.workspace.ProjectNotes, id: string): pxt.workspace.ProjectNotes {
    const index = notes.whiteboards.findIndex(board => board.id === id);
    if (index < 0) throw new Error(pxt.Util.lf("This whiteboard is no longer available."));
    if (notes.whiteboards.length <= 1) throw new Error(pxt.Util.lf("Keep at least one whiteboard."));
    const whiteboards = notes.whiteboards.filter(board => board.id !== id);
    return {
        ...notes,
        whiteboards,
        activeWhiteboardId: notes.activeWhiteboardId === id
            ? whiteboards[Math.min(index, whiteboards.length - 1)].id
            : notes.activeWhiteboardId
    };
}