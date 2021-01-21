const gulp = require("gulp");

const nextJsFiles = [
    "src/packages/omnihive/next-env.d.ts",
    "src/packages/omnihive/next.config.js",
    "src/packages/omnihive/postcss.config.js",
    "src/packages/omnihive/tailwind.config.js",
];

gulp.task("copy-next", function () {
    return gulp.src(nextJsFiles).pipe(gulp.dest("./dist/packages/omnihive"));
});
