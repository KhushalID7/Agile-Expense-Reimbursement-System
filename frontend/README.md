# React + TypeScript + Vite

## Development checks

Install dependencies with `npm ci`, then use:

- `npm run test` to run Vitest in watch mode.
- `npm run test:run` to run the frontend tests once, as used in CI.
- `npm run lint` to run Oxlint.
- `npm run build` to run the TypeScript check and Vite production build.

The repository CI workflow runs the frontend lint, test, and production build
checks alongside Django's system check, backend tests, and migration check.


Backend checks can be run from `backend/` after installing
`requirements.txt` with:

```text
python manage.py check
python manage.py test accounts expenses
python manage.py makemigrations --check --dry-run
```

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
