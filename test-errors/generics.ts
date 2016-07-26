class G<T> {} // TS9227

function id<T>(x: T): T { // TS9201 - unsupported type, could be better message
    return x
}
