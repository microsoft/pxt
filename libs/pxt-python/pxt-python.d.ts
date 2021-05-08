/// <reference no-default-lib="true"/>

declare namespace _py {
    interface Array {
        //% py2tsOverride="push($0)"
        append(value: any): void;

        //% py2tsOverride="concat($0)"
        extend(other: Array): void;

        //% py2tsOverride="insertAt($0, $1)"
        insert(index: number, value: any): void;

        //% py2tsOverride="removeElement($0)"
        remove(value: any): void;

        //% py2tsOverride="sort($0?)"
        sort(sorter?: (a: any, b: any) => number): void;

        //% py2tsOverride="reverse()"
        reverse(): void;

        //% py2tsOverride="slice()"
        copy(): void;

        //% pyHelper="py_array_pop"
        pop(index?: number): any;

        //% pyHelper="py_array_clear"
        clear(): void;

        //% pyHelper="py_array_index"
        index(value: any, start?: number, end?: number): number;

        //% pyHelper="py_array_count"
        count(value: any): number;
    }

    interface String {
        //% pyHelper="py_string_capitalize"
        capitalize(): string;

        //% pyHelper="py_string_casefold"
        casefold(): string;

        //% pyHelper="py_string_center"
        center(width: number, fillChar?: string): string;

        //% pyHelper="py_string_count"
        count(sub: string, start?: number, end?: number): number;

        //% pyHelper="py_string_endswith"
        endswith(suffix: string, start?: number, end?: number): boolean;

        //% pyHelper="py_string_find"
        find(sub: string, start?: number, end?: number): number;

        //% pyHelper="py_string_index"
        index(sub: string, start?: number, end?: number): number;

        //% pyHelper="py_string_isalnum"
        isalnum(): boolean;

        //% pyHelper="py_string_isalpha"
        isalpha(): boolean;

        //% pyHelper="py_string_isascii"
        isascii(): boolean;

        //% pyHelper="py_string_isdigit"
        isdigit(): boolean;

        //% pyHelper="py_string_isnumeric"
        isnumeric(): boolean;

        //% pyHelper="py_string_isspace"
        isspace(): boolean;

        //% pyHelper="py_string_isdecimal"
        isdecimal(): boolean;

        //% pyHelper="py_string_isidentifier"
        isidentifier(): boolean;

        //% pyHelper="py_string_islower"
        islower(): boolean;

        //% pyHelper="py_string_isprintable"
        isprintable(): boolean;

        //% pyHelper="py_string_istitle"
        istitle(): boolean;

        //% pyHelper="py_string_isupper"
        isupper(): boolean;

        //% pyHelper="py_string_join"
        join(iterable: any[]): string;

        //% pyHelper="py_string_ljust"
        ljust(width: number, fillChar?: string): string;

        //% pyHelper="py_string_lower"
        lower(): string;

        //% pyHelper="py_string_lstrip"
        lstrip(chars?: string): string;

        //% py2tsOverride="replace($0, $1)"
        replace(oldString: string, newString: string): string;

        //% pyHelper="py_string_rfind"
        rfind(sub: string, start?: number, end?: number): number;

        //% pyHelper="py_string_rindex"
        rindex(sub: string, start?: number, end?: number): number;

        //% pyHelper="py_string_rjust"
        rjust(width: number, fillChar?: string): string;

        //% pyHelper="py_string_rsplit"
        rsplit(sep?: string, maxSplit?: number): string[];

        //% pyHelper="py_string_rstrip"
        rstrip(chars?: string): string;

        //% pyHelper="py_string_split"
        split(sep?: string, maxsplit?: number): string[];

        //% pyHelper="py_string_splitlines"
        splitlines(keepends?: boolean): string[];

        //% pyHelper="py_string_startswith"
        startswith(prefix: string, start?: number, end?: number): boolean;

        //% pyHelper="py_string_strip"
        strip(chars?: string): string;

        //% pyHelper="py_string_swapcase"
        swapcase(): string;

        //% pyHelper="py_string_title"
        title(): string;

        //% pyHelper="py_string_upper"
        upper(): string;

        //% pyHelper="py_string_zfill"
        zfill(width: number): string;
    }

    interface Dict {
        clear(): void;
        copy(): void;
        get(key: string, defaultValue?: any): any;
        // items(): [string, any][];
        keys(): string[];
        pop(key: string, defaultValue?: any): any;
        // popitem(): [string, any];
        setdefault(key: string, defaultValue?: any): any;
        update(other: Dict): void;
        values(): any[];
    }

    interface Set {
        isdisjoint(other: Set): boolean;
        issubset(other: Set): boolean;
        issuperset(other: Set): boolean;
        union(other: Set): Set;
        intersection(other: Set): Set;
        difference(other: Set): Set;
        symmetric_difference(other: Set): Set;
        copy(): Set;
        update(other: Set): void;
        intersection_update(other: Set): void;
        difference_update(other: Set): void;
        symmetric_difference_update(other: Set): void;
        add(elem: any): void;
        remove(elem: any): void;
        discard(elem: any): void;
        pop(): any;
        clear(): void;
    }
}