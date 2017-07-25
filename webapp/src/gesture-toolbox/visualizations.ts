import { Point, Vector } from './types';
import * as Recorder from './recorder';
import * as GestureUI from './gesture';
const d3 = require('d3');

let dx: number = 7;
let maxVal: number = 2500;
let margin = {top: 0, right: 0, bottom: 0, left: 0};


export let normalLine = d3.line()
    .x((d: Point, i: number) => {
        return i * dx;
    })
    .y((d: Point, i: number) => {
        return d.Y;
    });

export let smoothedLine = d3.line()
    .x((d: Point, i: number) => {
        return i * dx;
    })
    .y((d: Point, i: number) => {
        return d.Y;
    })
    .curve(d3.curveCardinal);


export class RealTimeGraph {
    private graphDiv: any;
    private graphSvg: any;

    private width: number;
    private height: number;

    private data: Point[] = [];
    private path: any;


    constructor(_graph_id: string, color: string) {
        this.graphDiv = d3.select("#" + _graph_id);

        this.width = document.getElementById(_graph_id).offsetWidth - margin.left - margin.right;
        this.height = document.getElementById(_graph_id).offsetHeight - margin.top - margin.bottom;

        let y = d3.scaleLinear()
            .domain([-maxVal, +maxVal])
            .range([this.height, 0]);

        for (let i = 0; i < Math.round(this.width / dx); i++)
            this.data.push(new Point(i * dx, y(0)));

        this.graphSvg = this.graphDiv.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        this.path = this.graphSvg.append("path")
            .attr("d", smoothedLine(this.data))
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("fill", "none");
    }


    public update(yt: number, lineFun: any): void {
        let y = d3.scaleLinear()
            .domain([-maxVal, +maxVal])
            .range([this.height, 0]);

        this.data.push(new Point(this.width - dx, y(yt)));

        this.path.attr("d", lineFun(this.data))
            .attr("transform", null)
            .transition()
                .attr("transform", "translate(" + -dx + ")");

        this.data.shift();
    }
}


function drawGraph(data: Point[], axis: any, color: string) {
    let width = data.length * dx;
    let height = axis.node().offsetHeight - margin.top - margin.bottom;

    let y = d3.scaleLinear()
            .domain([-maxVal, +maxVal])
            .range([height, 0]);

    data.forEach((d: Point) => {d.Y = y(d.Y)});

    let svg = axis.append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("path")
        .attr("d", smoothedLine(data))
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("fill", "none");
}


export function drawContainer(gestIndex: number) {
    let container = d3.select("#" + GestureUI.gesturesContainerID)
        .append("div")
        .attr("class", "gesture-container")
        .attr("style", "overflow: auto; height: 300px;");

    let nameContainer = container.append("div")
        .attr("class", "gest-name-container");

    nameContainer.append("span")
        .html("Gesture Name: ");

    nameContainer.append("span")
        .attr("contenteditable", true)
        .attr("class", "gesture-name ui text big");

    let vidElement = container.append("video")
        .attr("class", "rec-video")
        .attr("autoplay", "rec-video")
        .attr("style", "rec-video")
        .attr("loop", "true");

    let mainGraph = container.append("div")
        .attr("class", "main-graph");

    mainGraph.append("div")
        .attr("class", "graph-x");
    mainGraph.append("div")
        .attr("class", "graph-y");
    mainGraph.append("div")
        .attr("class", "graph-z");

    let samples = container.append("div")
        .attr("class", "samples-container");

    container.append("br");

    // and then add it to that htmlContainer as a new object.
    Recorder.recData[gestIndex].htmlContainer = {video: vidElement, mainGraph: mainGraph, samplesContainer: samples};
}


export function drawVideo(gestIndex: number, vid: any) {
    Recorder.recData[gestIndex].htmlContainer.video.attr("src", vid);
}


export function drawMainGraph(gestIndex: number) {
    let data = Recorder.recData[gestIndex].displayGesture.rawData;

    let xAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-x");
    let yAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-y");
    let zAxis = Recorder.recData[gestIndex].htmlContainer.mainGraph.select(".graph-z");

    drawGraph(data.map((v: Vector) => { return new Point(0, v.X)}), xAxis, "red");
    drawGraph(data.map((v: Vector) => { return new Point(0, v.Y)}), yAxis, "green");
    drawGraph(data.map((v: Vector) => { return new Point(0, v.Z)}), zAxis, "blue");
}


export function drawGestureSample(gestIndex: number, sampleIndex: number) {
    let data = Recorder.recData[gestIndex].gestures[sampleIndex].rawData;
    let gestureID = Recorder.recData[gestIndex].gestureID;
    let sampleID = Recorder.recData[gestIndex].gestures[sampleIndex].sampleID;

    let graphContainer = Recorder.recData[gestIndex].htmlContainer.samplesContainer
        .append("div")
        .attr("class", "sample-graph")
        .attr("id", "sample-" + sampleID);

    if (sampleIndex != 0)
        graphContainer.append("div")
            .attr("class", "vertical-sep");

    // set width based on number of samples
    // height will be 32%

    let xAxis = graphContainer.append("div")
        .attr("class", "graph-x");

    let yAxis = graphContainer.append("div")
        .attr("class", "graph-y");

    let zAxis = graphContainer.append("div")
        .attr("class", "graph-z");

    graphContainer.append("button")
        .attr("class", "ui compact icon button")
        .on("click", function() {
            deleteGestureSample(gestureID, sampleID);
        })
        .append("i")
        .attr("class", "remove icon");

    drawGraph(data.map((v: Vector) => { return new Point(0, v.X)}), xAxis, "red");
    drawGraph(data.map((v: Vector) => { return new Point(0, v.Y)}), yAxis, "green");
    drawGraph(data.map((v: Vector) => { return new Point(0, v.Z)}), zAxis, "blue");
}


export function deleteGestureSample(gestureID: number, sampleID: number) {
    let gestIndex = -1;
    for (let i = 0; i < Recorder.recData.length; i++) {
        if (Recorder.recData[i].gestureID == gestureID)
            gestIndex = i;
    }
    if (gestIndex == -1) {console.error("gesture doesn't exist..."); return;}

    let sampleIndex = -1;
    for (let i = 0; i < Recorder.recData[gestIndex].gestures.length; i++) {
        if (Recorder.recData[gestIndex].gestures[i].sampleID == sampleID)
            sampleIndex = i;
    }
    if (sampleIndex == -1) {console.error("sample doesn't exist..."); return;}

    if (sampleIndex != 0) {
        Recorder.recData[gestIndex].gestures.splice(sampleIndex, 1);
        Recorder.recData[gestIndex].htmlContainer.samplesContainer.select("#sample-" + sampleID).remove();
    }
    else {
        // need to delete the whole container as well.
        // or (which I prefer): the add new gesture button (that I haven't implemented yet) would create an empty container
        // to be used and deleting the last sample will put the gesture in that state.
    }
}