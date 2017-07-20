import * as Types from './types';
const d3 = require('d3');

let smoothedLine = d3.line()
    .x((d: any) => {
        return d.X;
    })
    .y((d: any) => {
        return d.Y;
    })
    .curve(d3.curveBasis);

// initialize realtime graph:

// set initial data

// set size parameters
let graph_width;
// offset? maxval? graph height? 

let realtimedata;
// how do we want to make the update algorithm faster?

// append axis

// update realtime graph based on new data

// everything should be re-loadable (if you go out and come back again)

// everything should be downloadable (video as mp4, data as json)

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

