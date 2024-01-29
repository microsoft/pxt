/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Textarea } from "react-common/components/controls/Textarea";
import { loadProjectMetadataAsync } from "../transforms/loadProjectMetadataAsync";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

interface IProps {}

export const DebugInput: React.FC<IProps> = ({}) => {
    const [shareLink, setShareLink] = useState("https://makecode.microbit.org/S95591-52406-50965-65671");
    const [rubric, setRubric] = useState("");

    const evaluate = async () => {
        await loadProjectMetadataAsync(shareLink);
        await runEvaluateAsync(rubric);
    };

    return (
        <div className="debug-container">
            <div className="single-share-link-input-container">
                {lf("Share Link:")}
                <Input
                    id="shareLinkInput"
                    className="link-input"
                    placeholder={lf("Share link to validate")}
                    initialValue={shareLink}
                    onChange={setShareLink}
                />
            </div>
            <div className="rubric-json-input-container">
                {lf("Rubric:")}
                <Textarea id="rubricJsonInput" className="json-input" onChange={setRubric} resize="horizontal" />
            </div>
            <Button
                id="evaluateSingleProjectButton"
                className="btn-primary"
                onClick={evaluate}
                title={"Evaluate"}
                label={lf("Evaluate")}
            />
        </div>
    );
};
