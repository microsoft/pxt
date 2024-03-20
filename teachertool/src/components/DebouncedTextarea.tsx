import { useEffect, useRef } from "react";
import { Textarea, TextareaProps } from "react-common/components/controls/Textarea";

export interface DebouncedTextareaProps extends TextareaProps {
    intervalMs?: number; // Default 500 ms
}

// This functions like the React Common Input, but debounces onChange calls,
// so if onChange is called multiple times in quick succession, it will only
// be executed once after a pause of the specified `interval` in milliseconds.
export const DebouncedTextarea: React.FC<DebouncedTextareaProps> = ({ intervalMs = 500, ...props }) => {
    const timerId = useRef<NodeJS.Timeout | undefined>(undefined);
    const latestValue = useRef<string>("");

    const sendChange = () => {
        if (props.onChange) {
            props.onChange(latestValue.current);
        }
    };

    // If the timer is pending and the component unmounts,
    // clear the timer and fire the onChange event immediately.
    useEffect(() => {
        return () => {
            if (timerId.current) {
                clearTimeout(timerId.current);
                sendChange();
            }
        };
    }, []);

    const onChangeDebounce = (newValue: string) => {
        latestValue.current = newValue;

        if (timerId.current) {
            clearTimeout(timerId.current);
        }

        timerId.current = setTimeout(sendChange, intervalMs);
    };

    return <Textarea {...props} onChange={onChangeDebounce} />
};
