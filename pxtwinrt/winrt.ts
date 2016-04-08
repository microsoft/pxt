/// <reference path="../typings/bluebird/bluebird.d.ts"/>

namespace pxtwinrt {
    export function promisify<T>(p : Windows.Foundation.IPromise<T>) : Promise<T> {
        return new Promise<T>((resolve, reject) => {
          p.done(v => resolve(v), e => reject(e));  
        })
    }
    
    export function isWinRT() : boolean {
        return typeof Windows !== "undefined";
    }       
}