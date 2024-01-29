import * as React from "react";

import { File, FileMeta } from "../../package";
import { Button } from "../../../../react-common/components/controls/Button";
import { dialogAsync } from "../../core";

export interface FileTreeItemProps {
    file: File;
    meta: FileMeta;
    onItemClick: (fn: File) => void;
    onItemRemove: (fn: File) => void;
    onItemLocalize: (fn: File, localizedf: string) => void;
    onErrorClick?: (meta: FileMeta) => void;
    isActive: boolean;
    hasDelete?: boolean;
    previewUrl?: string;
    shareUrl?: string;
    addLocalizedFile?: string;
}

export const FileTreeItem = (props: FileTreeItemProps) => {
    const {
        isActive,
        hasDelete,
        file,
        meta,
        previewUrl,
        shareUrl,
        addLocalizedFile,
        onItemClick,
        onItemRemove,
        onItemLocalize,
        onErrorClick
    } = props;

    const onFileNameClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.open");
        onItemClick(file);
    }, [onItemClick, file]);

    const onDeleteClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.remove");
        onItemRemove(file);
    }, [onItemRemove, file]);

    const onErrorNumberClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.errors");
        if (onErrorClick) {
            onErrorClick(meta)
        }
    }, [onErrorClick, meta]);

    const onShareClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.share");
        dialogAsync({
            header: lf("Share this tutorial"),
            body: lf("Use this URL to open your tutorial in MakeCode."),
            copyable: shareUrl,
            hasCloseIcon: true
        });
    }, [shareUrl]);

    const onPreviewClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.preview");
        window.open(previewUrl, "_blank");
    }, [previewUrl]);

    const onLocalizeClick = React.useCallback(() => {
        pxt.tickEvent("explorer.file.addlocale");
        if (onItemLocalize && addLocalizedFile) {
            onItemLocalize(file, addLocalizedFile);
        }
    }, [onItemLocalize, addLocalizedFile, file]);

    const ariaLabel = isActive ?
        lf("{0}, it is the current opened file in the JavaScript editor", file.name) :
        file.name;

    let name = file.name.split("/").pop();

    if (meta.isGitModified) {
        name += " ↑";
    }

    return (
        <li role="none" className="file-treeitem">
            <Button
                role="treeitem"
                className="file-treeitem-label"
                ariaSelected={isActive}
                ariaLabel={ariaLabel}
                onClick={onFileNameClick}
                label={
                    <>
                        {name}
                        {meta.isReadonly &&
                            <i className="fas fa-lock" />
                        }
                    </>
                }
            />
            {hasDelete &&
                <Button
                    className="file-treeitem-button"
                    leftIcon="fas fa-trash"
                    title={lf("Delete file {0}", file.name)}
                    onClick={onDeleteClick}
                />
            }
            {!!(meta?.numErrors) &&
                <Button
                    className="file-treeitem-button red"
                    title={lf("Go to error")}
                    onClick={onErrorNumberClick}
                    label={meta.numErrors + ""}
                />
            }
            {shareUrl &&
                <Button
                    className="file-treeitem-button"
                    leftIcon="fas fa-share-alt"
                    title={lf("Share")}
                    onClick={onShareClick}
                />
            }
            {previewUrl &&
                <Button
                    className="file-treeitem-button"
                    leftIcon="fas fa-flask"
                    title={lf("Preview")}
                    onClick={onPreviewClick}
                />
            }
            {addLocalizedFile &&
                <Button
                    className="file-treeitem-button"
                    leftIcon="xicon globe"
                    title={lf("Add localized file")}
                    onClick={onLocalizeClick}
                />
            }
        </li>
    );
}