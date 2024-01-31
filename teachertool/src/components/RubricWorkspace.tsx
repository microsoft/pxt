import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/RubricWorkspace.module.scss";

import { DebugInput } from "./DebugInput";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveRubricDisplay } from "./ActiveRubricDisplay";

interface IProps {}

export const RubricWorkspace: React.FC<IProps> = () => {
    return (
        <>
            <DebugInput />
            <ActiveRubricDisplay />
            <EvalResultDisplay />
        </>
    );
};
