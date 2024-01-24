/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Textarea } from "react-common/components/controls/Textarea";
import { loadProjectMetadataAsync } from "../transforms/loadProjectMetadataAsync";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

interface IProps {}

const DebugInput: React.FC<IProps> = ({}) => {
    const [shareLink, setShareLink] = useState("https://arcade.makecode.com/S70821-26848-68192-30094");

    const evaluate = async () => {
        await loadProjectMetadataAsync(shareLink);
        await runEvaluateAsync();
    }

    return (
        <div className="debug-container">
            <div className="single-share-link-input-container">
                {lf("Share Link:")}
                <Input
                    id="shareLinkInput"
                    className="link-input"
                    placeholder={lf("Share link to validate")}
                    initialValue={shareLink}
                    onChange={setShareLink} />
            </div>
            <Button id="evaluateSingleProjectButton" className="primary" onClick={evaluate} title={"Evaluate"} label={lf("Evaluate")} />
        </div>
    )

};

export default DebugInput;
