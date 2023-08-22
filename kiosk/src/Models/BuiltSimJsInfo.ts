export class BuiltSimJSInfo {
    constructor(
        public js: string,
        public targetVersion?: string,
        public funArgs?: string[],
        public parts?: string[],
        public usedBuiltinParts?: string[]
    ) {
    }
}