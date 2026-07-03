# Tifton Fitness Workout Dashboard v28 — Blobs Runtime Fix

## What this update fixes

The prior client portal code hid the underlying Netlify Blobs connection error behind a generic “temporarily unavailable” message. This release adds a verified storage health endpoint and supports two connection modes:

1. **Automatic Netlify Blobs context** — Netlify normally provides this automatically to deployed Functions.
2. **Explicit service fallback** — for sites where the automatic Function context is missing, set the two Blobs service variables below.

## Required Function variables

These should be configured in Netlify under **Project configuration → Environment variables** with the **Functions** scope and **Production** context.

```text
ADMIN_PUBLISH_SECRET=your-long-private-publish-secret
INITIAL_ADMIN_LOGIN_ID=Admin1999
INITIAL_ADMIN_PIN=jaxroman
INITIAL_ADMIN_NAME=Jordan Roman
CLIENT_PORTAL_PIN=axon26
```

## Blobs fallback variables — add these for this site

```text
BLOBS_SITE_ID=your-Netlify-Project-ID
BLOBS_ACCESS_TOKEN=your-Netlify-personal-access-token
```

- `BLOBS_SITE_ID`: Netlify → Project configuration → General → Project information → Project ID.
- `BLOBS_ACCESS_TOKEN`: create a dedicated Netlify Personal Access Token for this application, then keep it as a **Functions-only secret**. Never put it in GitHub or the browser.

The Function uses this pair only when both values exist. It otherwise uses Netlify’s automatic Blobs credentials.

## Deployment

Replace the **root contents** of the GitHub `main` branch with this package. The repository root must contain `index.html`, `client.html`, `package.json`, `netlify.toml`, and the `netlify/` folder.

After pushing:

1. In Netlify, choose **Deploys → Trigger deploy → Clear cache and deploy site**.
2. Confirm the deploy is published.
3. Open `https://YOUR-SITE/.netlify/functions/client-portal`.
   - A working result returns JSON with `"storage":"connected"`.
4. Open `/`, sign in as Admin, and use **Publish Client Workouts** once.
5. Open `/client` and use the shared PIN `axon26`.

## Login paths

- Staff dashboard: `/`
- Shared client workout portal: `/client`
