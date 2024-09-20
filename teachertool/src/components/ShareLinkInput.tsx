import * as React from "react";
import css from "./styling/ShareLinkInput.module.scss";
import { useContext, useState, useMemo, useCallback, useEffect } from "react";
import { AppStateContext } from "../state/appStateContext";
import { classList } from "react-common/components/util";
import { Input } from "react-common/components/controls/Input";
import { loadProjectMetadataAsync } from "../transforms/loadProjectMetadataAsync";
import { Strings, Ticks } from "../constants";
import { getChecklistHash, makeToast } from "../utils";
import { showToast } from "../transforms/showToast";

interface IProps {}

export const ShareLinkInput: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { projectMetadata } = teacherTool;
    const [text, setText] = useState("");
    const [iconVisible, setIconVisible] = useState(false);
    const [inputRef, setInputRef] = useState<HTMLInputElement>();

    useEffect(() => {
        const shareId = pxt.Cloud.parseScriptId(text);
        setIconVisible(!!shareId && !(shareId === projectMetadata?.shortid || shareId === projectMetadata?.persistId));
    }, [text, projectMetadata?.shortid, projectMetadata?.persistId]);

    const onTextChange = (str: string) => {
        setText(str);
    };

    const onEnterKey = useCallback(() => {
        const shareId = pxt.Cloud.parseScriptId(text);
        if (!shareId) {
            pxt.tickEvent(Ticks.LoadProjectInvalid);
            showToast(makeToast("error", lf(Strings.InvalidShareLink)));
            return;
        }

        if (shareId !== projectMetadata?.shortid && shareId !== projectMetadata?.persistId) {
            pxt.tickEvent(Ticks.LoadProjectFromInput, { checklistHash: getChecklistHash(teacherTool.checklist) });
            loadProjectMetadataAsync(text, shareId);
        }
    }, [text, projectMetadata?.shortid, projectMetadata?.persistId]);

    const icon = useMemo(() => {
        return iconVisible ? "fas fa-arrow-right" : undefined;
    }, [iconVisible]);

    return (
        <div className={classList(css["share-link-input"], "tt-share-link-input")}>
            <Input
                placeholder={lf("Enter Project Link or Share ID")}
                ariaLabel={lf("Project Link or Share ID")}
                icon={icon}
                iconTitle={lf("Submit project link or share ID")}
                onChange={onTextChange}
                onEnterKey={onEnterKey}
                onIconClick={onEnterKey}
                onFocus={() => inputRef?.select()}
                preserveValueOnBlur={true}
                autoComplete={false}
                handleInputRef={setInputRef}
            ></Input>
        </div>
    );
};
