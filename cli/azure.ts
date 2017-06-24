/// <reference path="../typings/globals/node/index.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>

import U = pxt.Util;

let azure: any;
let serviceBus: any;
let queues: pxt.Map<boolean> = {};

export function initServiceBusAsync(queue: string): Promise<void> {
    pxt.log('loading azure tools')
    if (!azure) {
        try {
            azure = require('azure') as any;
        } catch (e) {
            U.userError('azure tools missing, did you run `npm install azure`?');
        }
    }
    pxt.log(`connecting to service bus queue ${queue}...`)
    try {
        serviceBus = azure.createServiceBusService();
    }
    catch (e) {
        console.log(e.message)
        U.userError('authentication failed, did you set your connection string in AZURE_SERVICEBUS_CONNECTION_STRING env var?')
    }

    return createQueueAsync(queue);
}

function createQueueAsync(queue: string): Promise<void> {
    if (queues[queue]) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
        serviceBus.createQueueIfNotExists(queue, function (err: any) {
            if (err) {
                pxt.log('service bus queue creation failed, did you give `MANAGE` claims to your connection string?')
                reject(err);
            }
            else {
                queues[queue] = true;
                resolve();
            }
        })
    })
}

export function sendMessageAsync(queue: string, msg: any): Promise<void> {
    return createQueueAsync(queue)
        .then(() => {
            return new Promise<void>((resolve, reject) => {
                serviceBus.sendQueueMessage(queue, msg, function (err: any) {
                    // ignore errors
                    if (err) pxt.log('service bus: message send failed');
                    resolve();
                })
            });
        })
}