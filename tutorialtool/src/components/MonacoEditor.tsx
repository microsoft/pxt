import * as React from "react";
import css from "./styling/MonacoEditor.module.scss";
import { Editor } from "@monaco-editor/react";
import { setCurrentTutorialMarkdownAsync } from "../transforms/setCurrentTutorialMarkdownAsync";


export const MonacoEditor = () => {
    const onMarkdownChange = React.useCallback((value: string | undefined) => {
        if (value) {
            setCurrentTutorialMarkdownAsync(value);
        }
    }, []);

    return (
        <div className={css["monaco-editor-outer"]}>
            <Editor
                defaultLanguage="markdown"
                onChange={onMarkdownChange}
            />
        </div>
    );
}