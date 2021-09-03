import React from "react";
import { storiesOf } from "@storybook/react";
import ServerManager from "../index";

const stories = storiesOf("Server Manager", module);

stories.add("Server Manager", () => {
    return (
        <div style={{ height: 600, width: 800 }}>
            <ServerManager />
        </div>
    );
});
