# Tifton Fitness Workout Dashboard v27 — Staff + Universal Client Portal

## Separate login paths

### Staff Workout Dashboard — `/`
The root URL is the staff workspace for the TV dashboard, Workout Builder, program calendar, Local Board, live publishing, and Team Access.

Initial staff login (configured through Netlify environment variables):

- Login ID: `Admin1999`
- PIN: `jaxroman`

After the initial login, an Admin can open **Menu → Team Access** to add individual Admin, Manager, and Coach login IDs/PINs. PINs are hashed server-side before they are saved in Netlify Blobs.

### Universal Client Training Portal — `/client`
The client route is separate and view-only. For temporary testing, everyone uses one shared PIN:

- Client portal PIN: `axon26`

The client portal receives the latest *published* Workout Builder board with all weeks, workouts, circuits, reps, and coach notes. It auto-refreshes every 20 seconds.

## Required Netlify environment variables

Create these in **Netlify → Project configuration → Environment variables**. Scope them to **Functions** and **Production**, then redeploy.

```text
ADMIN_PUBLISH_SECRET=use-a-long-random-secret
INITIAL_ADMIN_LOGIN_ID=Admin1999
INITIAL_ADMIN_PIN=jaxroman
INITIAL_ADMIN_NAME=Jordan Roman
CLIENT_PORTAL_PIN=axon26
```

`ADMIN_PUBLISH_SECRET` authorizes live client-board publishing and Team Access changes. Do not reuse it as a staff or client PIN.

## Publishing workflow

1. Sign into `/` with the initial Admin login ID and PIN.
2. Build, save, or import workouts in the Local Board.
3. Open **Menu → Publish Client Workouts**.
4. Enter `ADMIN_PUBLISH_SECRET` when prompted. The secret stays only for the current browser session.
5. Visit `/client` and use `axon26` to verify the live board.

Once the publish secret is stored for the session, routine Builder saves/imports queue a background live-sync attempt. Manual publish remains available as a confirmation step.

## Staff roles

- **Admin:** dashboard, Builder, publishing, and Team Access.
- **Manager:** dashboard, Builder, and publishing.
- **Coach:** dashboard and Builder. The live client publishing / Team Access controls are hidden.

The server-side publish secret remains required for any live write to Netlify Blobs.

## GitHub + Netlify deployment

Use this package as a full replacement at the **root** of the `main` branch. Do not nest it inside a parent folder.

```text
index.html
client.html
netlify.toml
_redirects
package.json
package-lock.json
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

`netlify.toml` runs the build and bundles the Netlify Function. The included `package.json` installs `@netlify/blobs` so GitHub deploys can package the function.

## Local Board safety

The Workout Builder preserves the current browser’s Local Board under the same storage key as the prior dashboard builds. This upgrade does not intentionally overwrite it. Export a TXT backup before a major code replacement as a recovery copy.
