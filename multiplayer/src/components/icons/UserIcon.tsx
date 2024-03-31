export default function Render(props: { slot: number; dataUri?: string }) {
    const { slot, dataUri } = props;

    if (dataUri) {
        return (
            <img
                className="pixel-art-image tw-w-[65%]"
                style={{
                    filter: slot === 0 ? "grayscale(1)" : undefined,
                }}
                src={dataUri}
                alt={lf("User set icon for player {0}", slot)}
            />
        );
    }

    return (
        <svg width="25" height="29" viewBox="0 0 25 29" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                style={{ fill: `rgb(var(--slot-${slot}-color))` }}
                d="M12.7544 14.686C16.6204 14.686 19.7544 11.552 19.7544 7.68602C19.7544 3.82003 16.6204 0.686035 12.7544 0.686035C8.8884 0.686035 5.75439 3.82003 5.75439 7.68602C5.75439 11.552 8.8884 14.686 12.7544 14.686ZM4.25439 16.686C2.32136 16.686 0.754339 18.2531 0.754395 20.1861L0.754409 20.6861C0.754421 23.0795 2.27704 25.1034 4.43931 26.4794C6.61345 27.863 9.55594 28.686 12.7543 28.686C15.9527 28.686 18.8952 27.863 21.0694 26.4795C23.2317 25.1034 24.7544 23.0795 24.7544 20.6861V20.186C24.7544 18.253 23.1874 16.686 21.2544 16.686H4.25439Z"
            />
        </svg>
    );
}
