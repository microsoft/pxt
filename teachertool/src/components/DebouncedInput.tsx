import { useRef } from "react";
import { Input, InputProps } from "react-common/components/controls/Input";

export interface DebouncedInputProps extends InputProps {
    intervalMs?: number | undefined;
}

// This functions like the React Common Input, but debounces onChange calls
// so they only fire once every `interval` milliseconds (defined in props)
export const DebouncedInput: React.FC<DebouncedInputProps> = props => {
    const timerId = useRef<NodeJS.Timeout | undefined>(undefined);

    const onChangeDebounce = (newValue: string) => {
        if (timerId.current) {
            clearTimeout(timerId.current);
        }

        timerId.current = setTimeout(() => {
            if (!props.onChange) {
                return;
            }

            props.onChange(newValue);
        }, props.intervalMs ?? 500);
    };

    return <Input {...props} onChange={onChangeDebounce} />;
};
