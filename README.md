# Tifton Fitness Workout Dashboard v25 — GitHub / Netlify Build Fix

This release fixes the Netlify GitHub deploy failure caused by the missing `@netlify/blobs` function dependency.

## Important: replace the branch root, do not merge a nested folder

In the `workoutdash` branch, the files at the repository root must include:

```text
index.html
client.html
client/
netlify/
netlify.toml
package.json
.npmrc
scripts/
```

Delete the old `package-lock.json` from prior releases if it exists. This project intentionally does not ship a lockfile because an earlier package contained a non-public registry URL. Netlify will install `@netlify/blobs` from npm during every build.

## Netlify build settings

In Netlify → Project configuration → Build & deploy → Continuous deployment → Build settings:

```text
Base directory: blank
Build command: leave blank (the repository netlify.toml supplies npm run build)
Publish directory: leave blank (the repository netlify.toml publishes .)
Functions directory: leave blank (the repository netlify.toml uses netlify/functions)
```

Do not set Base directory to a subfolder. The current `netlify.toml` expects `package.json`, `index.html`, and `netlify/functions/` at the branch root.

## Required environment variable

In Netlify → Project configuration → Environment variables:

```text
ADMIN_PUBLISH_SECRET=your-long-random-secret
```

Scope it to Functions and Production. Redeploy after adding or changing it.

## Deploy verification

A successful deploy log includes:

```text
[verify] Static files, Function source, and @netlify/blobs dependency are ready for Netlify bundling.
Packaging Functions from netlify/functions directory:
 - client-portal.js
```

After a successful deploy, test:

- `/` for the admin dashboard
- `/client` for the client workout portal
