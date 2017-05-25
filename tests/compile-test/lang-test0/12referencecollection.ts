function testRec0(): Testrec {
    let testrec = new Testrec();
    testrec.str2 = "Hello" + " world";
    testrec.str = testrec.str2;
    testrec.num = 42;
    assert(testrec.str == "Hello world", "recstr");
    assert(testrec.num == 42, "recnum");
    msg(testrec.str2);
    let testrec2 = <Testrec>null;
    assert(testrec2 == null, "isinv");
    assert(testrec == testrec, "eq");
    assert(testrec != null, "non inv");
    return testrec;
}

function testReccoll(): void {
    let coll: Testrec[] = [];
    let item = testRec0();
    msg("in reccoll");
    coll.push(item);
}

testReccoll();
