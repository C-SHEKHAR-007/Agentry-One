// Architecture rules for the web app (see README.md, "Structure").
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const httpOnlyInServices = {
  paths: [{ name: "axios", message: "Only services/ talks HTTP. Use a feature's API hooks (features/<area>/<area>.api.ts)." }],
  patterns: [
    { group: ["**/services/http/client"], message: "Only services/ talks HTTP. Use a feature's API hooks." },
    { group: ["@tanstack/*"], message: "Server state lives in RTK Query (services/api/baseApi)." },
  ],
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@typescript-eslint": tseslint.plugin, "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-restricted-imports": ["error", httpOnlyInServices],
      "no-restricted-globals": ["error", { name: "fetch", message: "Only services/ talks HTTP. Use a feature's API hooks." }],
      // API paths come from services/api/routes.ts, never string literals.
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/^\\/api\\//]", message: "Build API URLs with services/api/routes.ts." },
        { selector: "TemplateElement[value.raw=/^\\/api\\//]", message: "Build API URLs with services/api/routes.ts." },
      ],
    },
  },
  {
    // The HTTP layer itself, and tests that stub it.
    files: ["src/services/**", "src/test/**", "src/**/__tests__/**", "src/setupTests.ts"],
    rules: { "no-restricted-imports": "off", "no-restricted-globals": "off", "no-restricted-syntax": "off" },
  },
  {
    // Composition: the store wires the HTTP client's 401 handler to the session.
    files: ["src/app/store.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
