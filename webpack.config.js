module.exports = {
    mode: "production",
    entry: {
        chart: "./ts/chart.js",
        style: "./ts/style.js",
    },
    output: {
        filename: "[name].js",
        path: __dirname + "/public/js",
    },
};
