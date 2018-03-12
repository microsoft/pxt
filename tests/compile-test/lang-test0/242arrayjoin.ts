function testArrayJoin() {
    {
        msg("testArraySort")
        let strs = [1, 2, 3];
        let r = "A" + strs.join("X");
        assert(r == "AX1X2X3", "join");
    }

    {
        let strs = ["a", "b", "c"];
        let r = "B" + strs.join("Y");
        assert(r == "BYaYbYc", "joinstr");
    }
}

testArrayJoin()
