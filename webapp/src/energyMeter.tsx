// simple react component to display energy meter readings as a bar chart with color coding

import * as React from "react";

export interface EnergyMeterProps {
    readings: number[]; // array of energy readings
    maxReading: number; // maximum possible reading for scaling
}

export class EnergyMeter extends React.Component<EnergyMeterProps> {
    render() {
        const { readings, maxReading } = this.props;
        const barHeight = 20;
        const barSpacing = 5;

        return (
            <svg width="100" height={(barHeight + barSpacing) * readings.length}>
                {readings.map((reading, index) => {
                    const width = (reading / maxReading) * 100;
                    const color = reading > maxReading * 0.8 ? 'green' :
                                  reading > maxReading * 0.5 ? 'orange' : 'red';
                    return (
                        <rect
                            key={index}
                            x={0}
                            y={index * (barHeight + barSpacing)}
                            width={width}
                            height={barHeight}
                            fill={color}
                        />
                    );
                })}
            </svg>
        );
    }
}