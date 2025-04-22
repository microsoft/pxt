import * as React from "react";
import css from "./styling/MonacoEditor.module.scss";
import { setCurrentTutorialMarkdownAsync } from "../transforms/setCurrentTutorialMarkdownAsync";
import { initMonacoAsync } from "../utils/monaco";
import { useResizeObserver } from "../hooks/useResizeObserver";


export const MonacoEditorPane = () => {
    const [editor, setEditor] = React.useState<monaco.editor.IStandaloneCodeEditor>();
    const editorElement = React.useRef<HTMLDivElement | null>(null);

    useResizeObserver(editorElement.current, () => {
        if (editor) {
            requestAnimationFrame(() => editor.layout());
        }
    });

    const onMarkdownChange = React.useCallback((value: string | undefined) => {
        if (value) {
            setCurrentTutorialMarkdownAsync(value);
        }
    }, []);

    const handleDivRef = (element: HTMLDivElement | null) => {
        if (!element || editor) return;

        editorElement.current = element;

        (async () => {
            const editor = await initMonacoAsync(element);
            editor.onDidChangeModelContent(e => {
                onMarkdownChange(editor.getValue());
            })
            setEditor(editor);
        })();
    };

    return (
        <div ref={handleDivRef} className={css["monaco-editor-outer"]}>

        </div>
    );
}