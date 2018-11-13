class Node<T> {
    v: T;
    k: string;
    next: Node<T>;
}

class Map<T> {
    head: Node<T>;

    getElt(k: string): T {
        return mapGet(this, k)
    }

    setElt(k: string, v: T) {
        mapSet(this, k, v)
    }
}

function mapSet<T>(m: Map<T>, k: string, v: T) {
    for (let p = m.head; p != null; p = p.next) {
        if (p.k == k) {
            p.v = v
            return
        }
    }
    let n = new Node<T>()
    n.next = m.head
    n.k = k
    n.v = v
    m.head = n
}

function mapGet<T>(m: Map<T>, k: string): T {
    for (let p = m.head; p != null; p = p.next) {
        if (p.k == k) {
            return p.v
        }
    }
    return null
}


function search_array<T>(a: T[], item: T): number {
    for (let i = 0; i < a.length; i++) {
        if (a[i] == item) {
            return i
        }
    }
    return -1 // NOT FOUND
}

class MyMap<K, V> {

    keys: K[]
    values: V[]

    constructor() {
        this.keys = []
        this.values = []
    }

    push(key: K, value: V) {
        this.keys.push(key)
        this.values.push(value)
    }

    value_for(key: K): V {
        let i = search_array(this.keys, key)
        if (i == -1) {
            return null
        }
        return this.values[i]
    }

    key_for(value: V): K {
        let i = search_array(this.values, value)
        if (i == -1) {
            return null
        }
        return this.keys[i]
    }
    set(key: K, value: V): void {
        let i = search_array(this.keys, key)
        if (i == -1) {
            this.keys.push(key)
            this.values.push(value)
        } else {
            this.values[i] = value
        }
    }

    has_key(key: K): boolean {
        return search_array(this.keys, key) != -1
    }

    has_value(value: V): boolean {
        return search_array(this.values, value) != -1
    }

}


function testMaps() {
    let m = new Map<number>();
    let q = new Map<string>();
    let r = new MyMap<number, string>()

    mapSet(q, "one", "foo" + "bar")
    assert(mapGet(q, "one").length == 6, "m0")

    mapSet(q, "one", "foo2" + "bar")
    assert(mapGet(q, "one").length == 7, "m1")
    q.setElt("two", "x" + "y")
    assert(q.getElt("two").length == 2, "m2")
    q.setElt("two", "x" + "yz")
    assert(q.getElt("two").length == 3, "thr")


    mapSet(m, "one", 1)
    assert(mapGet(m, "one") == 1, "1")

    mapSet(m, "two", 2)
    assert(m.getElt("two") == 2, "2")
    //control.assert(mapGet(m, "zzzz") == null, "0")
}

testMaps()
