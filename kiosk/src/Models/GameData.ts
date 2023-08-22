export class GameData {
    constructor(public id: string,
        public name: string,
        public description: string,
        public highScoreMode: string,
        public uniqueIdentifier?: string,
        public date?: string,
        public userAdded?: boolean,
        public deleted?: boolean
        ) {
    }
}