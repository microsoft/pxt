import * as React from "react";
import * as ReactDOM from "react-dom";

interface IAppProps {}
interface IAppState {}

class MyApp extends React.Component<IAppProps, IAppState> {

  public state : IAppState;

  constructor(props : IAppProps) {
    super(props);
    this.state = {
    };
  }

  public componentDidMount() {
  }

  public render() {
    return (
      <div>
        Hello world!
      </div>
    );
  }
}

function render() {
    ReactDOM.render(<MyApp/>, $('#content')[0])    
}

$(document).ready(() => {
    $("#loading").remove();
    render()
})