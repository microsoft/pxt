function testArrayJoin() {
    {
        msg("testArrayJoin")
        let strs = [1, 2, 3];
        let r = "A" + strs.join("X");
        assert(r == "A1X2X3", "join");
    }

    {
        let strs = ["a", "b", "c"];
        let r = "B" + strs.join("Y");
        assert(r == "BaYbYc", "joinstr");
    }
}

testArrayJoin()
