import { useContext, useEffect } from "react";
import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { setRubricName } from "../transforms/setRubricName";
import { DebouncedInput } from "./DebouncedInput";
import { AddCriteriaButton } from "./AddCriteriaButton";
import css from "./styling/ActiveRubricDisplay.module.scss";
import React from "react";
import { CriteriaTable } from "./CriteriaTable";
import { getBlockImageUriAsync, getBlocksInfo } from "../services/makecodeEditorService";

interface ActiveRubricDisplayProps {}
export const ActiveRubricDisplay: React.FC<ActiveRubricDisplayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const [tempUri, setTempUri] = React.useState<string | undefined>(undefined);

    const [blocksInfo, setBlocksInfo] = React.useState<pxtc.BlocksInfo | undefined>(undefined);

    useEffect(() => {
        Promise.resolve().then(async () => {
            // TODO thsparks - move initializing this into a transform that runs on init.
            const info = await getBlocksInfo();
            setBlocksInfo(info);
            if (!info) return;

            const ids = Object.keys(info.blocksById);
            const randomType = ids[Math.floor(Math.random() * (ids.length - 1))];

            const blockUri = await getBlockImageUriAsync(randomType!);
            setTempUri(blockUri);
        });

    }, [teacherTool.rubric.name]);


    return (
        <div className={css["rubric-display"]}>
            <div className={css["rubric-name-input-container"]}>
                <DebouncedInput
                    label={Strings.Name}
                    ariaLabel={Strings.Name}
                    onChange={setRubricName}
                    placeholder={Strings.RubricName}
                    initialValue={teacherTool.rubric.name}
                    preserveValueOnBlur={true}
                    className={css["rubric-name-input"]}
                />
            </div>
            <div>{tempUri && <img className="ui image" src={tempUri} alt="sample block"/>}</div>
            <div>{`Blocks Info: ${!!blocksInfo}`}</div>
            {blocksInfo && <div>{`Block Count: ${blocksInfo.blocks.length}`}</div>}

            <CriteriaTable />
            <AddCriteriaButton />
        </div>
    );
};
