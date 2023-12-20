import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Textarea } from "react-common/components/controls/Textarea";

interface IProps {}

const DebugInput: React.FC<IProps> = ({}) => {
    const [shareLink, setShareLink] = useState("https://arcade.makecode.com/S50644-45891-08403-36583");
    const [rubric, setRubric] = useState("");

    const runEvaluate = () => {
        console.log(`Evaluate ${shareLink} with ${rubric}!`);
    }

    return <>
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
        <Button id="evaluateSingleProjectButton" className="primary" onClick={runEvaluate} title={"Evaluate"} label={lf("Evaluate")} />
    </>;
};

export default DebugInput;
