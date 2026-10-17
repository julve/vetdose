# Host VetDose on GitHub Pages

The website is generated at `docs/index.html`. It is the same self-contained app as `dist/VetDose.html`; it has no external JavaScript, stylesheet, font or application API dependency. `docs/.nojekyll` tells GitHub to serve the static files without Jekyll processing.

## One-time activation

1. Sign into GitHub and open https://github.com/julve/vetdose/settings/pages.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set the branch to **vetdose-v1.0** and the folder to **/docs**.
4. Click **Save**. Wait for the Pages deployment to complete; GitHub shows the resulting website address on this screen.
5. Open **https://julve.github.io/vetdose/** in a normal phone browser. Share this website link through WhatsApp instead of sending an HTML attachment.

GitHub Pages availability depends on repository visibility and the account plan. A public repository can use Pages on GitHub Free; Pages from a private repository requires a plan that supports it. If GitHub shows an upgrade requirement, the owner must choose a supported plan or explicitly decide to make the repository public. This setup does not change repository visibility.

If Pages is already configured with a different source, check the existing deployment before replacing that configuration. The root HTML has no absolute asset paths and works under the `/vetdose/` project prefix.

The cloud environment used to prepare this change can push Git commits, but its network proxy rejects connections to `api.github.com` and `julve.github.io` with CONNECT 403. Therefore Pages activation and the live website response could not be verified from that environment. Uploading the files is not proof that Pages is enabled.

## Phone use

- Open the site in Safari on iPhone or Chrome on Android. From WhatsApp, choose **Open in browser** if necessary.
- Optionally use the browser's **Add to Home Screen** command to create a shortcut. This does not add offline page caching.
- Internet is needed to open or reload the website. Calculations continue without network requests after the page loads.
- Each browser has its own library. Export JSON before changing browsers, clearing website data or moving to another phone. Import that backup on the other device.
- Visitors do not see a shared medication database. All starting doses and concentrations are blank; the user must enter them.

The app runs entirely in the visitor's browser. GitHub receives ordinary requests for the website files; the app does not upload the library, doses or patient identifiers. Local data is not guaranteed permanent and should be backed up.

## Updates

From the repository root, after changing source files:

```sh
npm test
npm run build
npm run test:ui
```

Commit and push the source and generated `docs/index.html` to the selected branch. Once branch-based Pages publishing is enabled, GitHub redeploys changes to `/docs`. Keep the existing website origin stable to retain access to the browser's local library. A changed origin requires transferring the library through JSON.

For version 1.1, the publication branch remains `vetdose-v1.0`; its name does not need to match the app version. The updated page displays **1.1**, required-field asterisks, fictional input examples and explanatory icons. Publish the regenerated `docs/Guia-de-usuario-VetDose.pdf` and `docs/guide-assets/` together with the page. The PDF download in Settings points to that file beside the hosted HTML. The optional portable ZIP is generated with `python3 scripts/package-portable.py` after rebuilding the app and PDF.

Use **Actions → pages build and deployment** in GitHub to inspect publication failures. A successful local build does not establish successful hosting.
