import "rc-dock/dist/rc-dock.css";
import "tailwindcss/dist/tailwind.css";
import "../../omnihive-desktop-core/styles/core.css";

export const parameters = {
    actions: { argTypesRegex: "^on[A-Z].*" },
    backgrounds: {
        default: "dark",
    },
    controls: {
        matchers: {
            color: /(background|color)$/i,
            date: /Date$/,
        },
    },
    darkMode: {
        current: "dark",
    },
    layout: "centered",
};
