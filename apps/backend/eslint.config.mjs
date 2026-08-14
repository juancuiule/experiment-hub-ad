import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/**",
      "eslint.config.mjs",
      "vitest.config.ts",
      "drizzle.config.ts",
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      // Decorator metadata requires classes to reference themselves/others
      // before declaration in a handful of Nest patterns (e.g. DI cycles
      // via forwardRef); keep this off rather than special-casing files.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);
