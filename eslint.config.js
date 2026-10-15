import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["dist/", "node_modules/"] },
    js.configs.recommended,
    {
        languageOptions: { ecmaVersion: 2023, sourceType: "module" },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-var": "error",
            "prefer-const": "error",
            eqeqeq: ["error", "always"],
            "no-console": ["warn", { allow: ["error"] }],
            "no-shadow": "warn",
            "no-return-await": "off",
        },
    },
    { files: ["src/**/*.js"], languageOptions: { globals: globals.browser } },
    { files: ["tests/**/*.js", "scripts/**/*.js"], languageOptions: { globals: globals.node } },
    // Script dòng lệnh: in kết quả ra terminal là chủ đích
    { files: ["scripts/**/*.js"], rules: { "no-console": "off" } },
    // Cấu hình webpack chạy bằng Node theo kiểu CommonJS
    { files: ["webpack.config.cjs"], languageOptions: { sourceType: "commonjs", globals: globals.node } },
];
