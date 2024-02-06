/// <reference path="../built/pxtlib.d.ts"/>

export function freshHeader(name: string, modTime: number) {
    let header: pxt.workspace.Header = {
        target: pxt.appTarget.id,
        targetVersion: pxt.appTarget.versions.target,
        name: name,
        meta: {},
        editor: pxt.JAVASCRIPT_PROJECT_NAME,
        pubId: "",
        pubCurrent: false,
        _rev: null,
        id: pxt.U.guidGen(),
        recentUse: modTime,
        modificationTime: modTime,
        cloudUserId: null,
        cloudCurrent: false,
        cloudVersion: null,
        cloudLastSyncTime: 0,
        isDeleted: false,
    }
    return header
}