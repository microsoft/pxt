import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as logview from "./logview"

export interface ITrendChartProps {
    className?: string;
    log: logview.ILogEntry;
    width:number;
    height:number;
}

export class TrendChart extends React.Component<ITrendChartProps, {}> {
    render() {
        const data = (this.props.log.accvalues || []).slice(-25); // take last 10 entry
        const margin = 2;
        const times = data.map(d => d.t)
        const values = data.map(d => d.v);
        const maxt = Math.max.apply(null, times);
        const mint = Math.min.apply(null, times);
        const maxv = Math.max.apply(null, values)
        const minv = Math.min.apply(null, values)
        const vph = this.props.height;
        const vpw = this.props.width;
        const h = (maxv - minv) || 10;
        const w = (maxt - mint) || 10;
        
        const points = data.map(d => `${(d.t - mint)/w*vpw},${vph - (d.v - minv)/h*(vph - 2 * margin) - margin}`).join(' ');
        
        return <svg className={this.props.className} viewBox={`0 0 ${vpw}  ${vph}`}>
            <g>
                <polyline points={points} />
            </g>
            </svg>
    }
}