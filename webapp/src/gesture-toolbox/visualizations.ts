import * as Types from './types';
const d3 = require("d3");

let smoothedLine = d3.line()
    .x((d: Types.Point) => {
        return d.X;
    })
    .y((d: Types.Point) => {
        return d.Y;
    })
    .curve(d3.curveBasis);