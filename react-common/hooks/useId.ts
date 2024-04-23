import * as React from "react";

export function useId(): string {
    return React.useMemo(() => pxt.Util.guidGen(), []);
}