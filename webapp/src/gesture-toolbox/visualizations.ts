import { Point, Vector } from './types';
import * as Recorder from './recorder';
import * as GestureUI from './gesture';
import * as Model from './model';

export const d3 = require('d3');


export class RealTimeGraph {
    // TODO: merge different line types into functions (instead of repeating them inside each function)
    private graphDiv: any;
    private graphSvg: any;

    private dx: number;
    private maxVal: number;
    private width: number;
    private height: number;

    private initialized: boolean = false;

    public isInitialized() {
        return this.initialized;
    }

    private data: number[] = [];
    private path: any;


    constructor(svg: any, width: number, height: number, maxVal: number, dx: number, color: string) {
        this.dx = dx;
        this.maxVal = maxVal;
        this.width = width;
        this.height = height;

        let y = d3.scaleLinear()
            .domain([-maxVal, +maxVal])
            .range([height, 0]);

        for (let i = 0; i < Math.round(width / dx); i++)
            this.data.push(y(0));

        let smoothedLine = d3.line()
            .x((d: number, i: number) => {
                return i * dx;
            })
            .y((d: number, i: number) => {
                return d;
            })
            .curve(d3.curveCardinal);

        svg.attr("width", width)
            .attr("height", height);

        this.path = svg.append("path")
            .attr("d", smoothedLine(this.data))
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        this.initialized = true;
    }


    public update(yt: number): void {
        let y = d3.scaleLinear()
            .domain([-this.maxVal, +this.maxVal])
            .range([this.height, 0]);

        this.data.push(y(yt));

        let smoothedLine = d3.line()
            .x((d: number, i: number) => {
                return i * this.dx;
            })
            .y((d: number, i: number) => {
                return d;
            })
            .curve(d3.curveCardinal);

        this.path.attr("d", smoothedLine(this.data))
            .attr("transform", null)
            .transition()
                .attr("transform", "translate(" + -this.dx + ")");

        this.data.shift();
    }
}


// function drawGraph(data: Point[], axis: any, color: string) {
//     let width = data.length * dx;
//     let height = axis.node().offsetHeight - margin.top - margin.bottom;

//     let y = d3.scaleLinear()
//             .domain([-maxVal, +maxVal])
//             .range([height, 0]);

//     data.forEach((d: Point) => {d.Y = y(d.Y)});

//     let svg = axis.select("svg");

//     if (svg.empty()) {
//         svg = axis.append("svg")
//             .attr("width", width)
//             .attr("height", height);

//         svg.append("path")
//         .attr("d", smoothedLine(data))
//             .attr("stroke", color)
//             .attr("stroke-width", 1)
//             .attr("fill", "none");
//     }
//     else {
//         svg.select("path")
//             .attr("d", smoothedLine(data))
//             .attr("stroke", color)
//             .attr("stroke-width", 1)
//             .attr("fill", "none");
//     }
// }


// export function drawContainer(gestIndex: number) {
//     let container = d3.select("#" + GestureUI.gesturesContainerID)
//         .append("div")
//         .attr("class", "gesture-container")
//         .attr("style", "overflow: auto; height: 300px;");

//     let nameContainer = container.append("div")
//         .attr("class", "gest-name-container");

//     nameContainer.append("span")
//         .html("Gesture Name: ");

//     nameContainer.append("span")
//         .attr("contenteditable", true)
//         .attr("class", "gesture-name ui text big");

//     let vidElement = container.append("video")
//         .attr("class", "rec-video")
//         .attr("autoplay", "rec-video")
//         .attr("style", "rec-video")
//         .attr("loop", "true");

//     let mainGraph = container.append("div")
//         .attr("class", "main-graph");

//     mainGraph.append("div")
//         .attr("class", "graph-x");
//     mainGraph.append("div")
//         .attr("class", "graph-y");
//     mainGraph.append("div")
//         .attr("class", "graph-z");

//     let samples = container.append("div")
//         .attr("class", "samples-container");

//     container.append("br");

//     // and then add it to that htmlContainer as a new object.
//     Recorder.recData[gestIndex].htmlContainer = {video: vidElement, mainGraph: mainGraph, samplesContainer: samples};
// }


// export function drawVideo(gestIndex: number, vid: any) {
//     Recorder.recData[gestIndex].htmlContainer.video.attr("src", vid);
// }


// export function drawMainGraph(gestIndex: number) {
//     let data = Recorder.recData[gestIndex].displayGesture.rawData;

//     let xAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-x");
//     let yAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-y");
//     let zAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-z");

//     drawGraph(data.map((v: Vector) => { return new Point(0, v.X)}), xAxis, "red");
//     drawGraph(data.map((v: Vector) => { return new Point(0, v.Y)}), yAxis, "green");
//     drawGraph(data.map((v: Vector) => { return new Point(0, v.Z)}), zAxis, "blue");
// }


// export function drawGestureSample(gestIndex: number, sampleIndex: number) {
//     let data = Recorder.recData[gestIndex].gestures[sampleIndex].rawData;
//     let gestureID = Recorder.recData[gestIndex].gestureID;
//     let sampleID = Recorder.recData[gestIndex].gestures[sampleIndex].sampleID;

//     let graphContainer = Recorder.recData[gestIndex].htmlContainer.samplesContainer
//         .append("div")
//         .attr("class", "sample-graph")
//         .attr("id", "sample-" + sampleID);

//     if (sampleIndex != 0)
//         graphContainer.append("div")
//             .attr("class", "vertical-sep");

//     // set width based on number of samples
//     // height will be 32%

//     let xAxis = graphContainer.append("div")
//         .attr("class", "graph-x");

//     let yAxis = graphContainer.append("div")
//         .attr("class", "graph-y");

//     let zAxis = graphContainer.append("div")
//         .attr("class", "graph-z");

//     graphContainer.append("button")
//         .attr("class", "ui compact icon button")
//         .on("click", function() {
//             deleteGestureSample(gestureID, sampleID);
//         })
//         .append("i")
//         .attr("class", "remove icon");

//     drawGraph(data.map((v: Vector) => { return new Point(0, v.X)}), xAxis, "red");
//     drawGraph(data.map((v: Vector) => { return new Point(0, v.Y)}), yAxis, "green");
//     drawGraph(data.map((v: Vector) => { return new Point(0, v.Z)}), zAxis, "blue");
// }


// export function deleteGestureSample(gestureID: number, sampleID: number) {
//     let gestIndex = -1;
//     for (let i = 0; i < Recorder.recData.length; i++) {
//         if (Recorder.recData[i].gestureID == gestureID)
//             gestIndex = i;
//     }
//     if (gestIndex == -1) {console.error("gesture doesn't exist..."); return;}

//     let sampleIndex = -1;
//     for (let i = 0; i < Recorder.recData[gestIndex].gestures.length; i++) {
//         if (Recorder.recData[gestIndex].gestures[i].sampleID == sampleID)
//             sampleIndex = i;
//     }
//     if (sampleIndex == -1) {console.error("sample doesn't exist..."); return;}

//     if (Recorder.recData[gestIndex].gestures.length != 1) {
//         Recorder.recData[gestIndex].gestures.splice(sampleIndex, 1);
//         Recorder.recData[gestIndex].htmlContainer.samplesContainer.select("#sample-" + sampleID).remove();
//     }
//     else {
//         // TODO:
//         // need to delete the whole container as well.
//         // or (which I prefer): the add new gesture button (that I haven't implemented yet) would create an empty container
//         // to be used and deleting the last sample will put the gesture in that state.
//     }

//     // TODO: update DTW models
//     Model.core.Update(Recorder.recData[gestureID].getData());
//     Recorder.recData[gestureID].displayGesture.rawData = Model.core.refPrototype;
//     drawMainGraph(gestureID);
// }


// export function setConnIndicator(isConnected: boolean) {
//     if (isConnected) {
//         setConnected();
//     }
//     else {
//         setDisconnected();
//     }
// }

// export function setConnected() {
//     let label = d3.select("#" + GestureUI.connectionIndicatorID);
//     label.attr("style", "color: white; background-color: green;");
    
//     label.select("span").html("Connected");
//     label.select("i").classed("remove", false);
//     label.select("i").classed("checkmark", true);
// }

// export function setDisconnected() {
//     let label = d3.select("#" + GestureUI.connectionIndicatorID);
//     label.attr("style", "color: white; background-color: red;");

//     label.select("span").html("Disconnected");
//     label.select("i").classed("remove", true);
//     label.select("i").classed("checkmark", false);
// }