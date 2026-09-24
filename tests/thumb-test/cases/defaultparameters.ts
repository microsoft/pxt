interface DpExact {
    exact(n: number): number;
}
class DpProbe implements DpExact {
    padded(n = 5): number { return n; }
    exact(n = 7): number { return n; }
    capture(n = 11): () => number { return () => ++n; }
}
class DpCtor {
    constructor(public value = 13) { }
}
function dpPlain(n: number): number { return n + 1; }
//% shim=TD_ID
function dpShim(n = 17): number { return n; }

const dpProbe = new DpProbe();
const dpDynamic: any = dpProbe;
const dpExact: DpExact = dpProbe;
const dpAction: () => number = dpDynamic.capture();
let dpTotal = dpDynamic.padded();
dpTotal += dpExact.exact(undefined);
dpTotal += dpExact.exact(0);
dpTotal += dpAction();
dpTotal += new DpCtor(undefined).value;
dpTotal += dpPlain(2) + dpShim();
console.log(dpTotal);