namespace _py {
    export const ATTRIBUTE_ERROR: string = "AttributeError";
    export const INDEX_ERROR: string = "IndexError";
    export const VALUE_ERROR: string = "ValueError";

    export function py_string_capitalize(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_casefold(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_center(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_count(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_endswith(str: string, suffix: string, start?: number, end?: number): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_find(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_index(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_isalnum(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isalpha(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isascii(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isdigit(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isnumeric(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isspace(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isdecimal(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isidentifier(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_islower(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isprintable(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_istitle(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isupper(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_join(str: string, iterable: any[]): string {
        nullCheck(str);
        return str;
    }

    export function py_string_ljust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_lower(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_lstrip(str: string, chars?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_replace(str: string, oldString: string, newString: string, count?: number): string {
        nullCheck(str);
        return str;
    }

    export function py_string_rfind(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_rindex(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_rjust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_rsplit(str: string, sep?: string, maxSplit?: number): string[] {
        nullCheck(str);
        return [];
    }

    export function py_string_rstrip(str: string, chars?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_split(str: string, sep?: string, maxsplit?: number): string[] {
        nullCheck(str);
        return [];
    }

    export function py_string_splitlines(str: string, keepends?: boolean): string[] {
        nullCheck(str);
        return [];
    }

    export function py_string_startswith(str: string, prefix: string, start?: number, end?: number): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_strip(str: string, chars?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_swapcase(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_title(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_upper(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_zfill(str : string, width: number): string {
        nullCheck(str);
        return str;
    }

    export function py_array_clear<T>(arr: T[]): void {
        nullCheck(arr);

        arr.length = 0;
    }

    export function py_array_count<T>(arr: T[], value: any): number {
        nullCheck(arr);

        let count = 0;

        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === value) count++;
        }

        return count;
    }

    function nullCheck(arg: any) {
        if (arg == null) {
            throw ATTRIBUTE_ERROR;
        }
    }
}