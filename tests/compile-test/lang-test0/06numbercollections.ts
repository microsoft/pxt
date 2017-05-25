function testNumCollection(): void {
    msg("test num coll")
    let collXYZ: number[] = [];
    assert(collXYZ.length == 0, "");
    collXYZ.push(42);
    msg("#1")
    assert(collXYZ.length == 1, "");
    collXYZ.push(22);
    assert(collXYZ[1] == 22, "");
    msg("#2")
    collXYZ.splice(0, 1);
    msg("#2")
    assert(collXYZ[0] == 22, "");
    msg("#2")
    collXYZ.removeElement(22);
    msg("#2")
    assert(collXYZ.length == 0, "");
    msg("loop")
    for (let i = 0; i < 100; i++) {
        collXYZ.push(i);
    }
    assert(collXYZ.length == 100, "");

    collXYZ = [1, 2, 3];
    assert(collXYZ.length == 3, "cons");
    assert(collXYZ[0] == 1, "cons0");
    assert(collXYZ[1] == 2, "cons1");
    assert(collXYZ[2] == 3, "cons2");
    msg("loop done")
}
testNumCollection();
