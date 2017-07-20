import { Point, Vector } from './types';
const d3 = require('d3');


export class RealTimeGraph {
    private graphDiv: any;
    private graphSvg: any;

    private width: number;
    private height: number;
    private dx: number;

    private maxInputVal: number;

    private data: Point[] = [];
    private path: any;

    private margin = {top: 0, right: 0, bottom: 0, left: 0};

    constructor(_graph_id: string, color: string, _dx: number, _maxInputVal: number) {
        this.graphDiv = d3.select("#" + _graph_id);
        this.dx = _dx;
        this.maxInputVal = _maxInputVal;

        this.width = document.getElementById(_graph_id).offsetWidth - this.margin.left - this.margin.right;
        this.height = document.getElementById(_graph_id).offsetHeight - this.margin.top - this.margin.bottom;

        let y = d3.scaleLinear()
            .domain([-this.maxInputVal, +this.maxInputVal])
            .range([this.height, 0]);

        for (let i = 0; i < Math.round(this.width / this.dx); i++)
            this.data.push(new Point(i * this.dx, y(0)));

        this.graphSvg = this.graphDiv.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        this.path = this.graphSvg.append("path")
            .attr("d", this.smoothedLine(this.data))
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("fill", "none");
    }


    public update(yt: number, lineFun: any): void {
        let y = d3.scaleLinear()
            .domain([-this.maxInputVal, +this.maxInputVal])
            .range([this.height, 0]);

        this.data.push(new Point(this.width - this.dx, y(yt)));

        this.path.attr("d", lineFun(this.data))
            .attr("transform", null)
            .transition()
                .attr("transform", "translate(" + -this.dx + ")");

        this.data.shift();
    }


    public normalLine = d3.line()
        .x((d: Point, i: number) => {
            return i * this.dx;
        })
        .y((d: Point, i: number) => {
            return d.Y;
        });


    public smoothedLine = d3.line()
        .x((d: Point, i: number) => {
            return i * this.dx;
        })
        .y((d: Point, i: number) => {
            return d.Y;
        })
        .curve(d3.curveCardinal);
}

// set size parameters
// let graph_width;
// offset? maxval? graph height? 

// let realtimedata;
// how do we want to make the update algorithm faster?

// append axis

// update realtime graph based on new data

// everything should be re-loadable (if you go out and come back again)

// everything should be downloadable (video as mp4, data as json)
