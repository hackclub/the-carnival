import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Type-aware rules: these need the TypeScript program, so they only run on TS sources.
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // A promise that is neither awaited nor explicitly discarded with `void` hides failures.
      "@typescript-eslint/no-floating-promises": "error",
      // JSX handlers (onClick={async () => ...}) are fine; everything else must not get a promise
      // where a void callback is expected.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      // A check the types say can never fire is either dead code or a type that lies; fix whichever it is.
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // Several flows deliberately do a full page load (sign-out, post-delete redirects).
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "import/no-duplicates": "error",
      "react/jsx-curly-brace-presence": ["error", "never"],
      "react/jsx-no-useless-fragment": "error",
      "react/self-closing-comp": "error",
    },
  },
  {
    // CLI scripts report progress on stdout.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  // Formatting belongs to Prettier; this turns off every ESLint rule that would fight it.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    ".claude/**",
    "drizzle/**",
  ]),
]);

export default eslintConfig;
