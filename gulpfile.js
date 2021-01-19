const gulp = require("gulp");
const del = require("del");

gulp.task("clean-dev", function (done) {
    del.sync(
        [
            "tsconfig.tsbuildinfo",
            "./packages/**/*.js",
            "./packages/**/*.d.ts",
            "./packages/**/*.d.ts.map",
            "./packages/**/*.js.map",
            "!gulpfile.js",
            "!jest.config.js",
        ],
        { force: true }
    );

    done();
});

gulp.task("clean-prod", function (done) {
    del.sync(["./packages/**/*.ts", "!./packages/**/*.d.ts"], { force: true });

    done();
});
