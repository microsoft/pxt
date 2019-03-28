let x = 1;
let z = "z"
{
    let a = "a"
    a += "b"
    {
        let x = "foo"
        x += "bar"
        a += "baz"
    }
    x--
}
(function () {
    let x = 5
    x += 3
})();