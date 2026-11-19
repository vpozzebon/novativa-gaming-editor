# Original PlayCanvas Editor — DEV build handoff

The native fork build produces its full original `dist/` directory. Its CI now uploads the complete output as a short-lived **candidate artifact** named `novativa-playcanvas-native-dev-<40-character-commit-sha>`.

Before upload, `scripts/novativa-native-artifact-manifest.mjs` writes `dist/novativa-native-manifest.json` with the exact Git commit and SHA256 checksum/byte count for every regular file, refusing symlinks. It verifies that `js/editor.js` and `css/editor.css` are present. These are build outputs, **not a runtime session**.

**Security and deployment boundary:** No automatic AWS/S3 upload, production promotion, public CDN, browser token, or active native editor is created by this workflow. The candidate must be independently retrieved from the trusted GitHub Actions artifact, integrity-checked against the expected commit before any private DEV deployment, and then served behind the existing Genesis-authenticated Platform BFF. The earlier Platform #151 gateway allows only core JS/CSS; it is not yet a complete static dependency gateway. The full Editor also needs a server-owned compatible `EditorConfig`, messenger and other APIs before `can_open` can change.

This package includes the original editor's auxiliary resources, including fonts, workers, WASM and static data where produced by upstream Vite, rather than pretending that two root assets constitute a standalone editor. No writes to `vale-ambar` are enabled.
