export class GameData {
    constructor(public id: string,
        public name: string,
        public description: string,
        public highScoreMode: string,
        public date?: string,
        public userAdded?: boolean,
        ) {
    }
}