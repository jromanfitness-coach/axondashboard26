# Tifton Fitness Workout Dashboard v29 — Automatic Blobs Authorization Fix

## What this fixes

The prior release incorrectly allowed `BLOBS_SITE_ID` and `BLOBS_ACCESS_TOKEN` to override Netlify’s built-in Function-to-Blobs credentials. A copied, expired, wrong-team, or insufficiently scoped personal token caused the 401 error in the Function logs.

This release removes that override. Deployed Netlify Functions authenticate to their own site’s Netlify Blobs automatically.

## Required Netlify Function variables

Add only these under **Project configuration → Environment variables** with **Functions** scope and **Production** context:

```text
ADMIN_PUBLISH_SECRET=your-long-private-publish-secret
INITIAL_ADMIN_LOGIN_ID=Admin1999
INITIAL_ADMIN_PIN=jaxroman
INITIAL_ADMIN_NAME=Jordan Roman
CLIENT_PORTAL_PIN=axon26
```

## Remove these old variables

Delete these if they exist in the Netlify project:

```text
BLOBS_SITE_ID
BLOBS_ACCESS_TOKEN
```

They are not needed for a Function accessing Blobs on the same Netlify site, and are the likely cause of the reported 401 error.

## Deploy

1. Replace the repository root contents with this package’s contents.
2. Commit to the `main` branch.
3. In Netlify, use **Deploys → Trigger deploy → Clear cache and deploy site**.
4. Open `https://YOUR-SITE/.netlify/functions/client-portal`. A working response includes `"storage":"connected"`.
5. In the staff dashboard, enter the publish secret once and use **Publish Client Workouts**.
6. Test the client portal at `/client` using `axon26`.

## Routes

- Staff dashboard: `/`
- Shared client workout portal: `/client`
