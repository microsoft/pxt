namespace indexed {
    interface Foo {
        [index: string]: string;
        foo: string;
    }

    interface Bar {
        [index: number]: string;
        foo: number;
    }

    export function run() {
        msg("Indexed types")

        let strIndex: {[index: string]: string} = {};
        strIndex["hello"] = "goodbye";
        assert(strIndex["hello"] === "goodbye", "String index read");

        let numIndex: {[index: number]: string} = {};
        numIndex[9] = "hello";
        assert(numIndex[9] === "hello", "Number index read");

        let strIndInter: Foo = {
            foo: "hello"
        };
        assert(strIndInter["foo"] === "hello", "String index read declared property");

        strIndInter["a"] = "b";
        assert(strIndInter["a"] === "b", "String index read dynamic property");

        strIndInter["foo"] = "hola";
        assert(strIndInter.foo === "hola", "String index set property via index");

        strIndInter.foo = "aloha";
        assert(strIndInter.foo === "aloha", "String index set property via qname");

        let numIndInter: Bar = {
            foo: 13
        };
        assert(numIndInter.foo === 13, "Number index read declared property");

        numIndInter[1] = "b";
        assert(numIndInter[1] === "b", "Number index read dynamic property");

        numIndInter.foo = 17
        assert(numIndInter.foo === 17, "Number index set property via qname");
    }
}

indexed.run();