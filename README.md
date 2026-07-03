# Tifton Fitness Workout Dashboard v26 — Split Admin & Client Login

## Two deliberately separate entry points

- **Admin Workout Dashboard:** `/`
  - Staff-only login.
  - Username: `Admin1999`
  - Password: `jaxroman`
  - This is where the Workout Builder, Local Board, Client Accounts, and publishing controls live.

- **Client Training Portal:** `/client`
  - Separate PIN-only login.
  - Clients receive only the assigned workout record returned by the server function.
  - The client portal never includes the Local Board, Client Accounts editor, admin controls, or other client assignments.

## Netlify + GitHub deployment

Use this as a full replacement at the root of your GitHub repository's `main` branch. The root must contain:

```text
index.html
client.html
netlify.toml
_redirects
package.json
.npmrc
netlify/
scripts/
```

Netlify build settings:

```text
Production branch: main
Base directory: blank
Build command: blank
Publish directory: blank
Functions directory: blank
```

The included `netlify.toml` installs the `@netlify/blobs` dependency and bundles `netlify/functions/client-portal.js`.

## Required Netlify environment variable

Create this server-side variable in Netlify under **Project configuration → Environment variables**:

```text
ADMIN_PUBLISH_SECRET=use-a-long-random-secret
```

Scope it to **Functions** and **Production**, then redeploy.

## Publishing workflow

1. Sign in to the admin dashboard at `/`.
2. Build, import, or update workouts in **Local Board**.
3. Use **Client Accounts** to choose each client's PIN, assigned week, and assigned workout.
4. Choose **Save & Publish**, or use **Publish Client Workouts** from Menu.
5. Enter the `ADMIN_PUBLISH_SECRET` when prompted. It is retained only for the active admin browser session.
6. Clients sign in at `/client` with their personal PIN. Their portal polls the live record every 20 seconds.

## Existing admin workouts

The Builder remains browser-local on the same site/device, using the existing Local Board record. Before a major deployment update, export a TXT Backup. Deploying this code update does not intentionally overwrite your Local Board.
