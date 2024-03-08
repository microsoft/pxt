import { useEffect, useState } from "react";
import { RequestStatus } from "../types";
import { fetchJsonDocAsync } from "../services/backendRequests";

export function useJsonDocRequest<T>(
    url: string,
    setStatus: (status: RequestStatus) => void,
    setJson: (data: T) => void
) {
    const [fetching, setFetching] = useState<boolean>();

    useEffect(() => {
        if (!fetching) {
            setFetching(true);
            setStatus("loading");
            Promise.resolve()
                .then(async () => {
                    const json = await fetchJsonDocAsync(url);
                    if (!json) {
                        setStatus("error");
                    } else {
                        setStatus("success");
                        setJson(json as T);
                    }
                })
                .catch(() => {
                    setStatus("error");
                });
        }
    }, [fetching]);
}
