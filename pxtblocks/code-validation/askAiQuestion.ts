namespace pxt.blocks {
    const aiEndpoint = "http://127.0.0.1:5000/api/v1/query";

    interface AiQueryRequest {
        query: string;
        intent: "makecode_evaluation",
        context: {
            share_id: string,
            target: string
        }
    }

    export async function askAiQuestion({ shareId, target, question }: { shareId: string, target: string, question: string}): Promise<{ responseMessage: string }> {
        let responseMessage = "";

        const request: AiQueryRequest = {
            query: question,
            intent: "makecode_evaluation",
            context: {
                share_id: shareId,
                target: target
            }
        }

        const requestJson = JSON.stringify(request);

        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestJson
        });

        if (!response.ok) {
            responseMessage = await response.text();
        } else {
            console.error(`Failed to query AI: ${response.status} ${response.statusText}`);
        }

        return { responseMessage };
    }
}