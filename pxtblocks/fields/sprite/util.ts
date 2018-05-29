namespace pxtblockly {
    export function mergeProps<T>(base: T, overrides?: Partial<T>): T {
        if (!overrides) {
            return base;
        }
        for (let key in overrides) {
            base[key] = overrides[key];
        }
        return base;
    }
}