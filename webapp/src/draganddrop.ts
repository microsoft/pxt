export function setupDragAndDrop(
    r: HTMLElement,
    dragged: (files: File[]) => void,
    draggedUri: (uri: string) => void,
    dragStart: () => void,
    dragEnd: () => void
) {
    r.addEventListener('paste', function (e: ClipboardEvent) {
        if (!e.clipboardData) return;
        let files = pxt.Util.toArray<File>(e.clipboardData.files);
        if (!files.length && e.clipboardData.items) {
            files = pxt.Util.toArray(e.clipboardData.items)
                .map(item => item.getAsFile());
        }
        if (files.length) {
            e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
            pxt.tickEvent("draganddrop.paste");
            dragged(files);
        }
    })
    r.addEventListener('dragstart', function (e: DragEvent) {
        console.log('dragstart')
        let types = e.dataTransfer.types;
        let found = false;
        for (let i = 0; i < types.length; ++i)
            if (types[i] == "Files" || types[i] == "text/uri-list")
                found = true;
        if (found) {
            pxt.tickEvent("draganddrop.drag");
            if (e.preventDefault) e.preventDefault(); // Necessary. Allows us to drop.
            e.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.
            dragStart();
            return false;
        }
        return true;
    }, false);
    r.addEventListener('drop', function (e: DragEvent) {
        console.log('drop')
        let files = pxt.Util.toArray<File>(e.dataTransfer.files);
        if (files.length > 0) {
            e.stopPropagation(); // Stops some browsers from redirecting.
            if (e.preventDefault) e.preventDefault();
            dragged(files);
        }
        else if (e.dataTransfer.types.indexOf('text/uri-list') > -1) {
            const imgUri = e.dataTransfer.getData('text/uri-list');
            if (imgUri) {
                e.stopPropagation(); // Stops some browsers from redirecting.
                if (e.preventDefault) e.preventDefault();
                draggedUri(imgUri);
            }
        }
        dragEnd();
        return false;
    }, false);
    // and we're done
    r.addEventListener('dragleave', end, false);
    r.addEventListener('dragexit', end, false);
    r.addEventListener('dragend', end, false);

    function end(e: DragEvent) {
        console.log('dragend')
        dragEnd();
        return false;
    }
}