class G<T> {} // Now supported

function id<T>(x: T): T { // Now supported
    return x
}

let x = id // now supported
