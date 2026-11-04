namespace pxsim {
    export class FileSystemState {
        public files: Map<string> = {};

        public append(file: string, content: string) {
            this.files[file] = (this.files[file] || "") + content;
        }

        public remove(file: string) {
            delete this.files[file];
        }
    }
}