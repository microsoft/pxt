import { Button } from "react-common/components/controls/Button";

export default function Render(props: {
    title: string;
    selected: boolean;
    label?: string | JSX.Element | undefined;
    onClick: () => void;
}) {
    return (
        <div>
            <Button
                className={`tw-m-0 tw-px-8 ${
                    props.selected ? "tw-font-bold" : ""
                }`}
                title={props.title}
                label={props.label ?? props.title}
                onClick={props.onClick}
            />
            <div
                className={
                    "tw-mx-1 tw-border-b-2 tw-rounded-sm tw-ease-linear tw-duration-[75ms]"
                }
                style={{
                    borderColor: props.selected
                        ? "var(--pxt-primary-background)"
                        : "transparent",
                }}
            ></div>
        </div>
    );
}
