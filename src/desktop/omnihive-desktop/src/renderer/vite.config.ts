import reactRefresh from "@vitejs/plugin-react-refresh";
import { defineConfig } from "vite";
import electron from "vitejs-plugin-electron";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [reactRefresh(), electron({ excludes: ["electron-store", "electron-better-ipc"] })],
    build: {
        target: "chrome89",
    },
});
