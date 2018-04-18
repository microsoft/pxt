export function setupDragAndDrop(r: HTMLElement, filter: (file: File) => boolean, dragged: (files: File[]) => void) {
    let dragAndDrop = document && document.createElement && 'draggable' in document.createElement('span');

    r.addEventListener('paste', function (e: ClipboardEvent) {
        if (e.clipboardData) {
            // has file?
            let files = pxt.Util.toArray<File>(e.clipboardData.files).filter(filter)
            if (files.length > 0) {
                e.stopPropagation(); // Stops some browsers from redirecting.
                e.preventDefault();
                dragged(files);
            }
            // has item?
            else if (e.clipboardData.items && e.clipboardData.items.length > 0) {
                let f = e.clipboardData.items[0].getAsFile()
                if (f) {
                    e.stopPropagation(); // Stops some browsers from redirecting.
                    e.preventDefault();
                    dragged([f])
                }
            }
        }
    })
    r.addEventListener('dragover', function (e: DragEvent) {
        let types = e.dataTransfer.types;
        let found = false;
        for (let i = 0; i < types.length; ++i)
            if (types[i] == "Files")
                found = true;
        if (found) {
            if (e.preventDefault) e.preventDefault(); // Necessary. Allows us to drop.
            e.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.
            return false;
        }
        return true;
    }, false);
    r.addEventListener('drop', function (e: DragEvent) {
        let files = pxt.Util.toArray<File>(e.dataTransfer.files);
        if (files.length > 0) {
            e.stopPropagation(); // Stops some browsers from redirecting.
            e.preventDefault();
            dragged(files);
        }
        return false;
    }, false);
    r.addEventListener('dragend', function (e: DragEvent) {
        return false;
    }, false);
}