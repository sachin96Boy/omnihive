import React from "react";
import { render } from "react-dom";
import App from "./App";
import "rc-dock/dist/rc-dock.css";
import "./index.css";

render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById("root")
);
