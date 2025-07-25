export interface DragAndDropHandler {
    filter: (file: File) => boolean;
    dragged: (files: File[]) => void;
    draggedUri?: (uri: string) => void;
    priority: number
}

let handlers: DragAndDropHandler[];

function init() {
    if (handlers) return; // already initialized
    handlers = [];

    const handleFiles = (files: File[]) => {
        let didHandle = false;
        for (const handler of handlers) {
            const handled = files.filter(handler.filter);

            if (handled.length) {
                didHandle = true;
                files = files.filter(f => handled.indexOf(f) < 0);
                handler.dragged(handled);

                if (!files.length) {
                    break;
                }
            }
        }

        return didHandle;
    }

    const element = document.body;
    element.addEventListener('paste', function (e: ClipboardEvent) {
        if (e.clipboardData) {
            let pastedFiles = pxt.Util.toArray<File>(e.clipboardData.files);
            let didHandle = false;

            if (pastedFiles?.length) {
                didHandle = handleFiles(pastedFiles);
            }
            else if (e.clipboardData.items && e.clipboardData.items.length > 0) {
                const item = e.clipboardData.items[0].getAsFile();
                if (item) {
                    didHandle = handleFiles([item]);
                }
            }

            if (didHandle) {
                e.stopPropagation();
                e.preventDefault();
            }
        }
    });

    element.addEventListener('dragover', function (e: DragEvent) {
        let types = e.dataTransfer.types;
        let found = false;
        for (let i = 0; i < types.length; ++i)
            if (types[i] == "Files" || types[i] == "text/uri-list")
                found = true;
        if (found) {
            if (e.preventDefault) e.preventDefault(); // Necessary. Allows us to drop.
            e.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.
            return false;
        }
        return true;
    }, false);

    element.addEventListener('drop', function (e: DragEvent) {
        let files = pxt.Util.toArray<File>(e.dataTransfer.files);
        if (files.length > 0) {
            e.stopPropagation(); // Stops some browsers from redirecting.
            e.preventDefault();
            handleFiles(files);
        }
        else if (e.dataTransfer.types.indexOf('text/uri-list') > -1) {
            const imgUri = e.dataTransfer.getData('text/uri-list');
            if (imgUri) {
                e.stopPropagation(); // Stops some browsers from redirecting.
                e.preventDefault();
                for (const handler of handlers) {
                    if (handler.draggedUri) {
                        handler.draggedUri(imgUri);
                        break; // only one handler can handle the URI
                    }
                }
            }
        }
        return false;
    }, false);

    element.addEventListener('dragend', function (e: DragEvent) {
        return false;
    }, false);
}

export function addDragAndDropHandler(handler: DragAndDropHandler) {
    init();

    handlers.push(handler);
    handlers.sort((a, b) => a.priority - b.priority);
    if (handlers.length == 1) init();
}

export function removeDragAndDropHandler(handler: DragAndDropHandler) {
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index >= 0) {
        handlers.splice(index, 1);
    }
}
