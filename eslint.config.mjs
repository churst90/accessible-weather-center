/**
 * Flat config. `.mjs` rather than `.js` because the repo's package.json has
 * no `"type": "module"` (Electron main is CJS), and Node warns on every run
 * about reparsing this file.
 *
 * `eslint-plugin-react-hooks` is pinned to ^5 on purpose. v7 ships the React
 * Compiler rule set — `set-state-in-effect`, `refs`, `immutability` — which
 * flags 28 sites here, nearly all of them deliberate: refs read inside
 * effects to avoid re-announcing to a screen reader, and `matchMedia`
 * initialisation that has to run once on mount. Those rules are worth
 * adopting, but it is a real refactor of working, tested code and it belongs
 * in its own change rather than riding along with a release. Bumping the
 * major without doing that work will turn CI red.
 */
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist/**", "dist-electron/**", "node_modules/**", "scripts/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "electron/**/*.ts"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
