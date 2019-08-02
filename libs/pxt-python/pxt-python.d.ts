/// <reference no-default-lib="true"/>

declare namespace _py {
    interface Array {
        //% tsOverride="push($0)"
        append(value: any): void;

        //% tsOverride="concat($0)"
        extend(other: Array): void;

        //% tsOverride="insertAt($0, $1)"
        insert(index: number, value: any): void;

        //% tsOverride="removeElement($0)"
        remove(value: any): void;

        //% tsOverride="removeAt($0=0)"
        pop(index?: number): any;

        //% tsOverride="length = 0"
        clear(): void;

        //% tsOverride="indexOf($0, $1?)"
        index(value: any, start?: number): number;

        // count(value: any): number;

        //% tsOverride="sort()"
        sort(): void;

        //% tsOverride="reverse()"
        reverse(): void;

        //% tsOverride="slice()"
        copy(): void;
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