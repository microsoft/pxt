import { dispatch } from "../state";
import { showToast } from "../state/actions";

export async function sendAbuseReportAsync(shareCode: string, text: string) {
    try {
        pxt.tickEvent("mp.reportabuse");
        const res = await fetch(`https://makecode.com/api/${shareCode}/abusereports`, {
            method: "POST",
            body: JSON.stringify({ text }),
        });
        if (res.status === 200) {
            dispatch(
                showToast({
                    type: "success",
                    text: lf("Thank you for helping keep Microsoft MakeCode a friendly place!"),
                    icon: "✅",
                    timeoutMs: 5000,
                })
            );
        } else {
            throw new Error("Failed to send abuse report");
        }
    } catch (e) {
        dispatch(
            showToast({
                type: "error",
                text: lf("Sorry, we couldn't send your report. Please try again later."),
                timeoutMs: 5000,
            })
        );
    } finally {
    }
}
