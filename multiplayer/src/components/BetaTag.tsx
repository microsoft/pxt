export default function Render() {
    return (
        <div className="tw-text-sm">
            <span className="tw-bg-white tw-shadow-sm tw-text-primary-color tw-rounded-md tw-font-bold tw-px-1 tw-pt-[0.05rem] tw-pb-[0.15rem] tw-mr-1">
                {lf("BETA")}
            </span>
            <span className="tw-text-white">{lf("Multiplayer")}</span>
        </div>
    );
}
