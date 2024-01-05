/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Textarea } from "react-common/components/controls/Textarea";
import { loadProjectAsync } from "../transforms/loadProjectAsync";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

interface IProps {}

const DebugInput: React.FC<IProps> = ({}) => {
    const [shareLink, setShareLink] = useState("https://arcade.makecode.com/S50644-45891-08403-36583");
    const [rubric, setRubric] = useState("");
    const [bools, setBools] = useState(true);

    const evaluate = async () => {
        setBools(!bools);
        await runEvaluateAsync(shareLink, rubric);
        loadProjectAsync("hi", bools);
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
            <div className="rubric-json-input-container">
                {lf("Rubric:")}
                <Textarea
                    id="rubricJsonInput"
                    className="json-input"
                    rows={20}
                    onChange={setRubric} />
            </div>
            <Button id="evaluateSingleProjectButton" className="primary" onClick={evaluate} title={"Evaluate"} label={lf("Evaluate")} />
        </div>
    )

};

export default DebugInput;
