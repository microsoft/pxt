import * as React from "react";
import * as ReactDOM from "react-dom";

declare var require: any;
var ace: AceAjax.Ace = require("brace");

require('brace/mode/typescript');
require('brace/mode/json');
require('brace/mode/c_cpp');

interface IAppProps { }
interface IAppState { }

class Editor extends React.Component<IAppProps, IAppState> {

    state: IAppState;
    editor: AceAjax.Editor;

    constructor(props: IAppProps) {
        super(props);
        this.state = {
        };
    }

    public componentDidMount() {
        this.editor = ace.edit('maineditor');
        
        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);        
        sess.setMode('ace/mode/typescript');
        this.editor.setFontSize("20px")
        this.editor.setValue(src, -1)
        
        require('brace/theme/cobalt');
        this.editor.setTheme('ace/theme/cobalt');
    }

    public render() {
        return (
            <div id='root'>
                <div id="filelist">
                    <div className="ui vertical pointing menu">
                        <a className="active item">
                            Home
                        </a>
                        <a className="item">
                            Messages
                        </a>
                        <a className="item">
                            Friends
                        </a>
                    </div>
                </div>
                <div id="maineditor">
                </div>
            </div>
        );
    }
}

var src =
`
class Greeter {
	greeting: string;
	constructor (message: string) {
		this.greeting = message;
	}
	greet() {
		return "Hello, " + this.greeting;
	}
}   

var greeter = new Greeter("world");

var button = document.createElement('button')
button.innerText = "Say Hello"
button.onclick = function() {
	alert(greeter.greet())
}

document.body.appendChild(button)

class Snake extends Animal {
   move() {
       alert("Slithering...");
       super(5);
   }
}

class Horse extends Animal {
   move() {
       alert("Galloping...");
       super.move(45);
   }
}

module Sayings {
    export class Greeter {
        greeting: string;
        constructor (message: string) {
            this.greeting = message;
        }
        greet() {
            return "Hello, " + this.greeting;
        }
    }
}
`

function render() {
    ReactDOM.render(<Editor/>, $('#content')[0])
}

$(document).ready(() => {
    $("#loading").remove();
    render()
})