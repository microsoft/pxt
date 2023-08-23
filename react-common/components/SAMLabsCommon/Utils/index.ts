//@ts-nocheck

export function parameterValidator(types, fn) {
    return (...args) => {
        types.forEach((type, index) => {
            if(!type || type === '*') return
            if(index >= args.length) return
            if(typeof args[index] !== type) throw new Error(`Invalid data of type "${typeof args[index]}", expected "${type}".`)
        })

        return fn(...args)
    }
}

