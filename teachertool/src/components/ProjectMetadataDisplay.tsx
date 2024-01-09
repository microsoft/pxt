/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";

interface IProps {}

const ProjectMetadataDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return <>
        {teacherTool.projectMetadata && <div className="project-metadata-display">
            <h4>{lf("Name: {0}", teacherTool.projectMetadata?.name)}</h4>
            <p>{teacherTool.projectMetadata?.description}</p>
        </div>}
    </>

};

export default ProjectMetadataDisplay;
