export const d3 = require('d3');
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./../sui";
import { Point, Gesture, GestureSample } from "./types";

export interface IGraphCard { parent?: any, gestureID?: number, sampleID?: number, dx?: number, graphHeight?: number, maxVal?: number, onDeleteHandler?: (gid: number, sid: number) => void }
export interface GraphCardState { editMode?: boolean }

export class GraphCard extends React.Component<IGraphCard, GraphCardState> {
    public static connected: boolean = false;

    private parentData: Gesture[];
    private sample: GestureSample;
    private svgX: any;
    private svgY: any;
    private svgZ: any;
    private svgCrop: any;

    constructor(props: IGraphCard) {
        super(props);
        // init
        this.props = props;
        this.parentData = props.parent.state.data;

        let gid = this.getGestureIndex(props.gestureID);
        let sid = this.getSampleIndex(gid, props.sampleID);

        this.sample = props.parent.state.data[gid].gestures[sid];

        this.state = { editMode: false };
        this.handleDelete = this.handleDelete.bind(this);
        this.handleEdit = this.handleEdit.bind(this);
        this.handleSave = this.handleSave.bind(this);
    }

    getGestureIndex(gid: number): number {
        for (let i = 0; i < this.parentData.length; i++) {
            if (this.parentData[i].gestureID == gid) return i;
        }

        return -1;
    }

    getSampleIndex(gid: number, sid: number): number {
        for (let i = 0; i < this.parentData[gid].gestures.length; i++) {
            if (this.parentData[gid].gestures[i].sampleID == sid) return i;
        }

        return -1;
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    handleDelete(e: any) {
        this.props.onDeleteHandler(this.props.gestureID, this.props.sampleID);
    }

    handleEdit(e: any) {
        this.setState({ editMode: true });
        // change UI into edit mode

        // let container = d3.select(ReactDOM.findDOMNode(this.refs["graphContainer"]));

        // let svgX = d3.select(ReactDOM.findDOMNode(this.refs["svgX"]));
        // let svgY = d3.select(ReactDOM.findDOMNode(this.refs["svgY"]));
        // let svgZ = d3.select(ReactDOM.findDOMNode(this.refs["svgZ"]));


    }

    handleSave(e: any) {
        this.setState({ editMode: false });
        // onSampleChange handler (passed from parent) should be called.
        // the handler will change the state of itself (=parent)
    }

    // on "edit" click 
    // setState -> editMode: true

    // on "delete" click 
    // parent.onSampleDeleteHandler(this) (or use the sampleID)
    // and then the parents state will get updated (as the shouldComponentUpdate will detect a change in the number of samples)

    // on "crop" event
    // parent.onSampleCropHandler(s, e);

    componentDidMount() {
        // displays the graph and initializes all of the SVGs to be used in other places.
        let width = this.sample.rawData.length * this.props.dx;
        let height = this.props.graphHeight;

        let y = d3.scaleLinear()
            .domain([-this.props.maxVal, +this.props.maxVal])
            .range([height, 0]);

        let smoothedLine = d3.line()
            .x((d: number, i: number) => {
                return i * this.props.dx;
            })
            .y((d: number, i: number) => {
                return d;
            })
            .curve(d3.curveCardinal);

        let constrain = (d: number) => {
            if (d > this.props.maxVal) return this.props.maxVal;
            else if (d < -this.props.maxVal) return -this.props.maxVal;
            else return d;
        }

        let dataX: number[] = [];
        let dataY: number[] = [];
        let dataZ: number[] = [];

        for (let i = 0; i < this.sample.rawData.length; i++) {
            dataX.push(y(constrain(this.sample.rawData[i].X)));
            dataY.push(y(constrain(this.sample.rawData[i].Y)));
            dataZ.push(y(constrain(this.sample.rawData[i].Z)));
        }

        d3.select(ReactDOM.findDOMNode(this.refs["graphContainer"]))
            .attr("style", "width: " + (width + 25).toString() + "px;");

        this.svgX = d3.select(ReactDOM.findDOMNode(this.refs["svgX"]));
        this.svgY = d3.select(ReactDOM.findDOMNode(this.refs["svgY"]));
        this.svgZ = d3.select(ReactDOM.findDOMNode(this.refs["svgZ"]));

        this.svgX.attr("width", width)
            .attr("height", height);
        this.svgY.attr("width", width)
            .attr("height", height);
        this.svgZ.attr("width", width)
            .attr("height", height);

        this.svgX.append("path")
            .attr("d", smoothedLine(dataX))
            .attr("stroke", "red")
            .attr("stroke-width", 1)
            .attr("fill", "none");
        this.svgY.append("path")
            .attr("d", smoothedLine(dataY))
            .attr("stroke", "green")
            .attr("stroke-width", 1)
            .attr("fill", "none");
        this.svgZ.append("path")
            .attr("d", smoothedLine(dataZ))
            .attr("stroke", "blue")
            .attr("stroke-width", 1)
            .attr("fill", "none");


        let svgCropWidth = width - this.props.dx; //because the graph doesn't show the last point! TODO: fix this!
        let svgCropHeight = height * 3 + 15;
        let strokeWidth = 2;

        this.svgCrop = d3.select(ReactDOM.findDOMNode(this.refs["svgCrop"]));
        this.svgCrop.attr("width", svgCropWidth)
            .attr("height", svgCropHeight)
            .attr("style", "background: rgba(0, 0, 0, 0); opacity: 1; position: absolute; top: 16px;");

        function dragLeft(d: any) {
            if (d3.event.x > 0 && d3.event.x < svgCropWidth /*&& d3.event.x < the other controlLine*/) {
                d3.select(this).attr("d", "M" + (d3.event.x + (strokeWidth / 2)).toString() + " 0 v " + svgCropHeight);
                d3.select(this.parentNode).select(".leftRec").attr("width", d3.event.x);
            }
        }

        function dragRight(d: any) {
            if (d3.event.x > 0 && d3.event.x < svgCropWidth /*&& d3.event.x < the other controlLine*/) {
                d3.select(this).attr("d", "M" + (d3.event.x + (strokeWidth / 2)).toString() + " 0 v " + svgCropHeight);
                console.log("dx:" + d3.event.x);
                d3.select(this.parentNode).select(".RightRec").attr("width", svgCropWidth - d3.event.x).attr("x", d3.event.x);
            }
        }

        this.svgCrop.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 50) //TODO: should initialize all of these with the cropStart/End values
            .attr("height", svgCropHeight)
            .attr("fill", "rgba(0, 0, 0, 0.5)")
            .attr("class", "leftRec");
        this.svgCrop.append("path")
            .attr("d", "M" + (50 + (strokeWidth / 2)).toString() + " 0 v " + svgCropHeight)
            .attr("stroke-width", strokeWidth)
            .attr("stroke", "black") //attr("id", "").on("click", () => {})
            .attr("style", "cursor:w-resize")
            .call(d3.drag()
                .on("drag", dragLeft));

        this.svgCrop.append("rect")
            .attr("x", svgCropWidth)
            .attr("y", 0)
            .attr("width", 0) //TODO: should initialize all of these with the cropStart/End values
            .attr("height", svgCropHeight)
            .attr("fill", "rgba(0, 0, 0, 0.5)")
            .attr("class", "RightRec");
        this.svgCrop.append("path")
            .attr("d", "M" + (svgCropWidth - strokeWidth / 2).toString() + " 0 v " + svgCropHeight)
            .attr("stroke-width", strokeWidth)
            .attr("stroke", "black") //attr("id", "").on("click", () => {})
            .attr("style", "cursor:w-resize")
            .call(d3.drag()
                .on("drag", dragRight));
        
    }

    shouldComponentUpdate(nextProps: IGraphCard, nextState: GraphCardState, nextContext: any): boolean {
        return this.state.editMode != nextState.editMode;
    }

    render() {
        let headerStyle = { height: "60px" };
        let containerStyle = { display: "inline-block", margin: "0 10px 10px 0" };

        return (
            <div className="ui segments" style={containerStyle}>
                <div className="ui segment inverted" style={headerStyle}>
                    {
                        this.state.editMode == true
                        ?
                            <button onClick={this.handleSave} className="ui labeled violet icon button tiny compact left floated">
                                <i className="toggle on icon"></i>
                                Save
                            </button>
                        :
                            <button onClick={this.handleEdit} className="ui labeled icon button tiny compact left floated">
                                <i className="toggle off icon"></i>
                                Edit
                            </button>
                    }
                    <button onClick={this.handleDelete} className="ui icon black button tiny compact right floated">
                        <i className="remove icon"></i>
                    </button>
                </div>
                <div ref="graphContainer" className="ui segment">
                    <svg ref="svgX"></svg>
                    <svg ref="svgY"></svg>
                    <svg ref="svgZ"></svg>
                    <svg ref="svgCrop"></svg>
                </div>
            </div>
        );
    }
}
