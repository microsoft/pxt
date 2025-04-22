/// <reference path="../../../localtypings/monaco.d.ts" />


export function initMonacoAsync(element: HTMLElement): Promise<monaco.editor.IStandaloneCodeEditor> {
    return new Promise<monaco.editor.IStandaloneCodeEditor>((resolve, reject) => {
        if (typeof ((window as any).monaco) === 'object') {
            // monaco is already loaded
            resolve(createEditor(element));
            return;
        }
        let monacoPaths: pxt.Map<string> = (window as any).MonacoPaths

        let onGotAmdLoader = () => {
            let req = (window as any).require
            req.config({ paths: monacoPaths });

            // Load monaco
            req(['vs/editor/editor.main'], () => {
                setupMonaco();
                resolve(createEditor(element));
            });
        };

        // Load AMD loader if necessary
        if (!(<any>window).require) {
            let loaderScript = document.createElement('script');
            loaderScript.type = 'text/javascript';
            loaderScript.src = monacoPaths['vs/loader'];
            loaderScript.addEventListener('load', onGotAmdLoader);
            document.body.appendChild(loaderScript);
        } else {
            onGotAmdLoader();
        }
    })
}

function setupMonaco() {
}

function createEditor(element: HTMLElement): monaco.editor.IStandaloneCodeEditor {
    const inverted = pxt.appTarget.appTheme.invertedMonaco;

    let editor = monaco.editor.create(element, {
        ariaLabel: pxt.Util.lf("JavaScript editor"),
        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'monospace'",
        scrollBeyondLastLine: true,
        language: "markdown",
        mouseWheelZoom: false,
        wordBasedSuggestions: true,
        lineNumbersMinChars: 3,
        formatOnPaste: true,
        folding: true,
        glyphMargin: false,
        minimap: {
            enabled: false
        },
        fixedOverflowWidgets: true,
        autoIndent: "full",
        useTabStops: true,
        dragAndDrop: true,
        matchBrackets: "always",
        occurrencesHighlight: false,
        quickSuggestionsDelay: 200,
        theme: inverted ? 'vs-dark' : 'vs',
        renderIndentGuides: true
    });

    editor.layout();

    return editor;
}
