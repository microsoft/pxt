import css from "./App.module.scss";
import { Toaster } from "@/components/Toaster";
import { classList } from "react-common/components/util";

export function App() {
    return <div className={classList(`${pxt.appTarget.id}`, css["app"])}>
        <Toaster />
        {/* Other components can be added here */}
        <h1>Welcome to Teachable Machine</h1>
        {/* Add more content as needed */}
    </div>
}