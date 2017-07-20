import { Point, Vector } from './types';
const d3 = require('d3');

let smoothedLine = d3.line()
    .x((d: any) => {
        return d.X;
    })
    .y((d: any) => {
        return d.Y;
    })
    .curve(d3.curveBasis);

let normalLine = d3.line()
    .x((d: Point, i: number) => {
        return i * dx;
    })
    .y((d: Point, i: number) => {
        return d.Y;
    });

let easeLine = d3.line()
    .x((d: Point, i: number) => {
        return i * dx;
    })
    .y((d: Point, i: number) => {
        return d.Y;
    })
    .curve(d3.curveCardinal);

let graphDataX: Point[] = [];
let graphDataY: Point[] = [];
let graphDataZ: Point[] = [];

let graph_pathX: any;
let graph_pathY: any;
let graph_pathZ: any;

let graph_div: any;
let graph_svg: any;

let dx = 3;

let graph_width: number;
let graph_height: number;

// initialize realtime graph:
export function init(graph_id: string, _graph_width: number, _graph_height: number) {
    graph_width = _graph_width;
    graph_height = _graph_height;

    let maxGraphSamples = Math.round(_graph_width / dx);

    for (let i = 0; i < maxGraphSamples; i++) {
        graphDataX.push(new Point(i * dx, 100));
        graphDataY.push(new Point(i * dx, 200));
        graphDataZ.push(new Point(i * dx, 300));
    }

    graph_div = d3.select("#" + graph_id);
    graph_svg = graph_div.append("svg")
        .attr("width", _graph_width)
        .attr("height", _graph_height);

    graph_pathX = graph_svg.append("path")
        .attr("d", easeLine(graphDataX))
        .attr("stroke", "blue")
        .attr("stroke-width", 1)
        .attr("fill", "none");

    graph_pathY = graph_svg.append("path")
        .attr("d", easeLine(graphDataY))
        .attr("stroke", "green")
        .attr("stroke-width", 1)
        .attr("fill", "none");

    graph_pathZ = graph_svg.append("path")
        .attr("d", easeLine(graphDataZ))
        .attr("stroke", "red")
        .attr("stroke-width", 1)
        .attr("fill", "none");
}

export function update(xt: Vector) {
    graphDataX.push(new Point(graph_width - dx, xt.X + 85));
    graphDataY.push(new Point(graph_width - dx, xt.Y + 185));
    graphDataZ.push(new Point(graph_width - dx, xt.Z + 285));

    graph_pathX.attr("d", easeLine(graphDataX))
        .attr("transform", null)
        .transition()
            .attr("transform", "translate(" + -dx + ")");


    graph_pathY.attr("d", easeLine(graphDataY))
        .attr("transform", null)
        .transition()
            .attr("transform", "translate(" + -dx + ")");


    graph_pathZ.attr("d", easeLine(graphDataZ))
        .attr("transform", null)
        .transition()
            .attr("transform", "translate(" + -dx + ")");

    graphDataX.shift();
    graphDataY.shift();
    graphDataZ.shift();
}


// optimize it based on this:
        // push a new data point onto the back
        // data.push(random());

        // // redraw the line, and then slide it to the left
        // path
        //     .attr("d", line)
        //     .attr("transform", null)
        // .transition()
        //     .attr("transform", "translate(" + x(-1) + ")");

        // // pop the old data point off the front
        // data.shift();


// set initial data

// set size parameters
// let graph_width;
// offset? maxval? graph height? 

// let realtimedata;
// how do we want to make the update algorithm faster?

// append axis

// update realtime graph based on new data

// everything should be re-loadable (if you go out and come back again)

// everything should be downloadable (video as mp4, data as json)
