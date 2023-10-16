export async function downloadTargetConfigAsync(): Promise<
    pxt.TargetConfig | undefined
> {
    try {
        return await pxt.targetConfigAsync();
    } catch (e) {
        console.error(e);
    }
}
