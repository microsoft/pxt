import ReactionsIcon from "./icons/ReactionsIcon";

export default function Render() {
    const keyData = {
        [lf("up")]: ["↑", "W"],
        [lf("down")]: ["↓", "S"],
        [lf("left")]: ["←", "A"],
        [lf("right")]: ["→", "D"],
        a: ["Z", lf("{id:keyboard symbol}space")],
        b: ["X", lf("{id:keyboard symbol}enter")],
    };

    return (
        <div className="tw-bg-neutral-50 tw-p-3 tw-border-2 tw-border-neutral-500 tw-border-solid tw-rounded-md tw-drop-shadow-xl">
            <div className="tw-text-lg tw-mb-2 tw-font-bold">{lf("Keyboard Controls")}</div>
            {Object.keys(keyData).map((action, i) => {
                return (
                    <div key={i} className="keymap-row">
                        {keyData[action].map((key, j) => {
                            return (
                                <div
                                    className="keymap-key tw-align-middle tw-min-w-[2.5rem] tw-text-center tw-pb-[2.1rem]"
                                    key={j}
                                >
                                    {key}
                                </div>
                            );
                        })}
                        <span className="keymap-name tw-font-semibold">{action}</span>
                    </div>
                );
            })}
            <div className="keymap-row tw-flex tw-flex-row tw-items-center">
                <div className="keymap-key tw-align-middle tw-min-w-[2.5rem] tw-text-center tw-pb-[2.1rem]">1 - 6</div>
                <span className="keymap-name tw-font-semibold tw-text-center">
                    <ReactionsIcon />
                </span>
            </div>
        </div>
    );
}
