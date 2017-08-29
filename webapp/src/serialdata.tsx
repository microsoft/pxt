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
    points: canvaschart.Point[] = [];

    acceptsFile(file: pkg.File) {
        return file.name === "serialdata.json"
    }

    display() {
        window.addEventListener("message", (ev: MessageEvent) => {
            let msg = ev.data;
            console.log("PINEAPPLE " + msg.type);
            if (msg.type === "serial") {
                let data = msg.data.slice(0, msg.data.length - 1);
                let datasplit = data.split(":");
                let x = datasplit[0];
                let y = datasplit[1];
                this.points.push(new canvaschart.Point(Date.now(), y));
                new canvaschart.CanvasChart().drawChart(document.getElementById("fizzle") as HTMLCanvasElement, this.points);
            }
        });
        return (
            <div className="ui content">
                <canvas id="fizzle">
                </canvas>
            </div>
        )
    }

    /** 
    domUpdate() {
    }
    **/
}