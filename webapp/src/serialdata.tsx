import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as codecard from "./codecard"
import * as canvaschart from "./canvaschart"

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf

export class Editor extends srceditor.Editor {
    acceptsFile(file: pkg.File) {
        if (file.name != "serialdata.json") return false
        return true
    }

    display() {
        return (
            <div className="ui content">
                <canvas id="fizzle">
                </canvas>
            </div>
        )
    }
        /** 
        let serialDataWrapper = document.createElement("div");
        serialDataWrapper.className = "ui content";
        let chartElement = document.createElement("canvas");
        **/
        /**
        let serialDataWrapper = <div></div>
        let canvasElement = document.createElement("canvas");
        canvasElement.id = "foo";
        return ({canvasElement})
        **/
        /** 
        let p: pxsim.Point[] = [];
        p.push(new pxsim.Point(1, 2));
        p.push(new pxsim.Point(3, 4));
        p.push(new pxsim.Point(5, 6));
        new canvaschart.CanvasChart().drawChart(canvasElement, p);
        serialDataWrapper.appendChild(canvasElement);
        //serialDataWrapper.appendChild(chartElement);
        return serialDataWrapper;
        **/
        /**
        return (
            <div className="ui content">
            {}
                <div className="ui segment form text" style={{ backgroundColor: "white" }}>
                    <canvas></canvas>

                    <sui.Input label={lf("Name")} value={c.name} onChange={setFileName}/>
                    {userConfigs.map(uc =>
                        <sui.Checkbox
                            key={`userconfig-${uc.description}`}
                            inputLabel={uc.description}
                            checked={isUserConfigActive(uc) }
                            onChange={() => applyUserConfig(uc) } />
                    ) }
                    <sui.Field>
                        <sui.Button text={lf("Save")} class={`green ${this.isSaving ? 'disabled' : ''}`} onClick={() => save()} />
                        <sui.Button text={lf("Edit Settings As text") } onClick={() => this.editSettingsText() } />
                    </sui.Field>
                </div>
            </div>
        )
        **/

    domUpdate() {
        let p: pxsim.Point[] = [];
        p.push(new pxsim.Point(1, 2));
        p.push(new pxsim.Point(3, 4));
        p.push(new pxsim.Point(5, 6));
        new canvaschart.CanvasChart().drawChart(document.getElementById("fizzle") as HTMLCanvasElement, p);
        console.log("here!!!");
    }
}