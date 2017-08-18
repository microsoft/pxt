import { Point, Vector, Match } from './types';
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

export class RecognitionOverlay {
    private overlaySVG: any;
    private overlayWidth: number;
    private overlayHeight: number;
    private dx: number;

    private activeMatches: Match[];
    private activeRectangles: any[];
    private tickCount: number[];

    constructor(svg: any, width: number, height: number, dx: number) {
        this.overlaySVG = svg;
        this.dx = dx;
        this.overlayWidth = width - dx; //because the graph doesn't show the last point! TODO: fix this!
        this.overlayHeight = height * 3 + 15;
        this.activeMatches = [];
        this.activeRectangles = [];
        this.tickCount = [];
        

        svg.attr("width", this.overlayWidth)
            .attr("height", this.overlayHeight)
            .attr("style", "background: rgba(0, 0, 0, 0); position: absolute; top: 16px; left: 16px;");
    }

    public add(match: Match, curTick: number) {
        let width = (match.Te - match.Ts) * this.dx;
        let offsetX = (curTick - match.Te) * this.dx;
        let rect = this.overlaySVG.append("rect")
            .attr("x", this.overlayWidth - width - offsetX)
            .attr("y", 0)
            .attr("width", width) //TODO: should initialize all of these with the cropStart/End values
            .attr("height", this.overlayHeight)
            .attr("fill", "rgba(0, 255, 0, 0.25)");
        
        this.activeMatches.push(match);
        this.activeRectangles.push(rect);
        this.tickCount.push(0);
    }

    public tick(curTick: number) {
        for (let i = 0; i < this.activeMatches.length; i++) {
            let width = this.activeMatches[i].Te - this.activeMatches[i].Ts;

            if (curTick - this.activeMatches[i].Te >= this.overlayWidth / this.dx) {
                // remove rectangle from DOM
                this.activeRectangles[i].remove();
                
                this.activeRectangles.splice(i, 1);
                this.activeMatches.splice(i, 1);
                this.tickCount.splice(i, 1);
            }
            else {
                let transX = (-this.dx * (++this.tickCount[i])).toString();
                this.activeRectangles[i].transition().duration(100).attr("transform", "translate(" + transX + ")");
            }
        }
    }
}
