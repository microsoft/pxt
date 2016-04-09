/// <reference path="../typings/bluebird/bluebird.d.ts"/>

namespace pxtwinrt {
    export function promisify<T>(p : Windows.Foundation.IPromise<T>) : Promise<T> {
        return new Promise<T>((resolve, reject) => {
          p.done(v => resolve(v), e => reject(e));  
        })
    }
    
    export function toArray<T>(v : any) : T[] {
        let r : T[] = [];
        let length = v.length;
        for(let i = 0; i<length; ++i) r.push(v[i])
        return r;
    }
    
    export function isWinRT() : boolean {
        return typeof Windows !== "undefined";
    }       
    
    export function initAsync() {
        if (!isWinRT()) return Promise.resolve();                 
        initSerial();
            
        return Promise.resolve();
    }
}