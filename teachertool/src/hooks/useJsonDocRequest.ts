import { useEffect, useState } from "react";
import { RequestStatus } from "../types";
import { fetchJsonDocAsync } from "../services/backendRequests";

export function useJsonDocRequest<T>(
    url: string,
    statusCb: (status: RequestStatus) => void,
    jsonCb: (data: T) => void
) {
    const [status, setStatus] = useState<RequestStatus | undefined>();

    useEffect(() => {
        if (!status) {
            setStatus("loading");
            statusCb("loading");
            Promise.resolve().then(async () => {
                const json = await fetchJsonDocAsync(url);
                if (!json) {
                    setStatus("error");
                    statusCb("error");
                } else {
                    setStatus("success");
                    statusCb("success");
                    jsonCb(json as T);
                }
            });
        }
    }, []);
}
