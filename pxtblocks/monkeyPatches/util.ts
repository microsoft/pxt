// Asserts a method exists on the target before we monkey patch it.
export function assertMethod(target: any, key: string) {
    if (typeof target?.[key] !== "function") {
        throw new Error(`Blockly monkey patch target missing method: ${key}`);
    }
}
