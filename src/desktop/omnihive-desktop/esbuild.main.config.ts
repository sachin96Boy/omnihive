import { BuildOptions } from "esbuild";
import path from "path";

export default {
    platform: "node",
    entryPoints: [path.resolve("src/main/main.ts")],
    bundle: true,
    target: "node16.9.0", // electron version target
} as BuildOptions;
