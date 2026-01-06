import * as React from "react";

import { Modal } from "../controls/Modal";
import { Input } from "../controls/Input";
import { Button } from "../controls/Button";

export interface ShareLinkDialogProps {
    visible: boolean;
    shareUrl?: string;
    title?: string;
    ariaLabel?: string;
    linkAriaLabel?: string;
    className?: string;
    children?: React.ReactNode;
    onClose: () => void;
}

export const ShareLinkDialog: React.FC<ShareLinkDialogProps> = props => {
    const {
        visible,
        shareUrl,
        title,
        ariaLabel,
        linkAriaLabel,
        className,
        children,
        onClose,
    } = props;

    const [copySuccessful, setCopySuccessful] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (visible) setCopySuccessful(false);
    }, [visible, shareUrl]);

    const handleCopyClick = () => {
        if (!shareUrl) return;

        if (pxt.BrowserUtils.isIpcRenderer()) {
            setCopySuccessful(!!inputRef.current && pxt.BrowserUtils.legacyCopyText(inputRef.current));
            return;
        }

        navigator.clipboard.writeText(shareUrl);
        setCopySuccessful(true);
    };

    const handleCopyBlur = () => {
        setCopySuccessful(false);
    };

    if (!visible) return <></>;

    const modalClassName = ["sharedialog", "share-link-dialog", className].filter(Boolean).join(" ");

    return <Modal
        title={title || lf("Share")}
        className={modalClassName}
        parentElement={document.getElementById("root") || undefined}
        onClose={onClose}
        ariaLabel={ariaLabel || lf("Share link modal")}
    >
        <div className="project-share">
            <div className="project-share-info">
                <div className="project-share-content">
                    <div className="project-share-data">
                        {!!children && <div className="share-link-dialog-top">
                            {children}
                        </div>}

                        <div className="common-input-attached-button">
                            <Input
                                ariaLabel={linkAriaLabel || lf("Shareable link")}
                                handleInputRef={(ref: HTMLInputElement) => inputRef.current = ref}
                                initialValue={shareUrl}
                                readOnly={true}
                                selectOnClick={true}
                            />
                            <Button
                                className={copySuccessful ? "green" : "primary"}
                                title={lf("Copy link")}
                                label={copySuccessful ? lf("Copied!") : lf("Copy")}
                                leftIcon="fas fa-link"
                                onClick={handleCopyClick}
                                onBlur={handleCopyBlur}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Modal>;
};
