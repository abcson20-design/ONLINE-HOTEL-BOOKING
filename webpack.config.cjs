const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: "./src/index.js",

    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
        clean: true
    },

    module: {
        rules: [
            {
                // package.json có "type": "module" nên cho phép import không cần đuôi .js
                test: /\.m?js$/,
                resolve: { fullySpecified: false }
            },
            {
                // ảnh banner / phòng (jpg, png, webp, svg)
                test: /\.(png|jpe?g|webp|svg)$/i,
                type: "asset/resource"
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    },

    plugins: [
        new HtmlWebpackPlugin({
            templateContent: `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Online Hotel Booking</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            </head>
            <body>
                <div id="app"></div>
            </body>
            </html>
            `
        })
    ],

    devServer: {
        port: 3000,
        open: true
    }
};