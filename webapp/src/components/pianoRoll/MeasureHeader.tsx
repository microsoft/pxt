import { range } from "./utils";

interface Props {
    measures: number;
}

export const MeasureHeader = (props: Props) => {
    const { measures } = props;

    return (
        <div className="measure-header" id="measure-header">
            {range(0, measures).map(m =>
                <div key={m + 1} className="measure">{m + 1}</div>
            )}
        </div>
    );
}