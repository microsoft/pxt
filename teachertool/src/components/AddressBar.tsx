import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/AddressBar.module.scss";

import { useContext, useState, useMemo, useCallback, useEffect } from "react";
import { AppStateContext } from "../state/appStateContext";
import { classList } from "react-common/components/util";
import { Input } from "react-common/components/controls/Input";
import { loadProjectMetadataAsync } from "../transforms/loadProjectMetadataAsync";

interface IProps {
    className?: string;
}

export const AddressBar: React.FC<IProps> = ({ className }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { projectMetadata } = teacherTool;
    const [text, setText] = useState("");
    const [iconVisible, setIconVisible] = useState(false);

    useEffect(() => {
        const shareId = pxt.Cloud.parseScriptId(text);
        setIconVisible(!!shareId && !(shareId === projectMetadata?.shortid || shareId === projectMetadata?.persistId));
    }, [text, projectMetadata?.shortid, projectMetadata?.persistId]);

    const onTextChange = (str: string) => {
        setText(str);
    };

    const onEnterKey = useCallback(() => {
        const shareId = pxt.Cloud.parseScriptId(text);
        if (!!shareId && !(shareId === projectMetadata?.shortid || shareId === projectMetadata?.persistId)) {
            loadProjectMetadataAsync(shareId);
        }
    }, [text, projectMetadata?.shortid, projectMetadata?.persistId]);

    const icon = useMemo(() => {
        return iconVisible ? "fas fa-arrow-right" : undefined;
    }, [iconVisible]);

    return (
        <div className={classList(css["address-bar"], className)}>
            <Input
                placeholder={lf("Enter Project Link or Share ID")}
                ariaLabel={lf("Enter Project Link or Share ID")}
                icon={icon}
                onChange={onTextChange}
                onEnterKey={onEnterKey}
                preserveValueOnBlur={true}
            ></Input>
        </div>
    );
};
