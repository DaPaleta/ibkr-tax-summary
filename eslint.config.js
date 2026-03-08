import js from "@eslint/js"
import prettier from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URLSearchParams: "readonly",
      },
    },
    plugins: { prettier },
    rules: {
      ...prettier.configs.recommended.rules,
      "prettier/prettier": "error",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    ignores: ["node_modules/**", "*.csv"],
  },
]
