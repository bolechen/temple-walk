# The desktop app (MyGo)

`pnpm run app` packages the built site as a desktop app with [MyGo](https://github.com/egoist/mygo) v0.10.0, replacing the Pake path (#220, closed): one tool for macOS, Windows and Linux, with signed auto-updates built in.

## What it does

1. builds the site (`pnpm build`) unless `--skip-build`;
2. copies `dist/` to a scratch folder and takes the page-view counter (`u.rushiwowen.co`) out of the copy's `index.html`; `dist/` itself is untouched;
3. writes the scratch mygo project: `main.go` from `main.go.template` (serve the site, check the update feed once after launch, install and relaunch), `mygo.json` from `updates.json` (the window carries over the Pake settings: 1440×900, min 960×600, maximised, hidden title bar, dark, closing quits);
4. runs `mygo build`: embeds the site, compiles, signs (ad-hoc without a Developer ID), writes the `.app` and `.dmg` (macOS), and with the update key the signed archive and manifest;
5. stages everything to `tools/out/app/v<version>/` (git-ignored).

Options: `--app` skips the dmg, `--skip-build` packages the existing `dist/`, `--keep` keeps the scratch folder. Cross-compiling a platform needs running the mygo build with `GOOS`/`GOARCH`; the CI matrix (#261) does this, not this script.

## The update key

```sh
go install github.com/egoist/mygo/cmd/mygo@v0.10.0
mygo keygen -o tools/app-keys        # writes mygo-update.key (SECRET) and mygo-update.pub
```

- `tools/app-keys/` is git-ignored. The secret also goes to the password manager and, for CI, the `MYGO_UPDATER_PRIVATE_KEY` secret. **Losing it strands installed apps; anyone who has it can ship code to your users.**
- Paste the contents of `mygo-update.pub` into `updates.json`'s `publicKey` (replacing the placeholder).
- With no key at all the app still builds; mygo skips the update archive and manifest and says so.

## Publishing an update

`mygo build` writes, per platform, `temple-walk-<version>-<platform>.tar.gz`, `update-<platform>.json` and delta updates from the published versions. Publishing to `updatesUrl` (`https://temple.rushiwowen.co/updates/desktop`):

1. upload the archives, deltas and `install.sh`;
2. **upload the manifests last**, so apps never see a manifest naming missing files;
3. keep earlier versions' files in place (deltas read them).

`updates.s3` in `updates.json` would let `mygo build -upload` do this to an S3/R2 bucket directly. A build machine that cannot reach the feed skips deltas and says why. The feed URL must be https.

## Verified

2026-11-19, this Mac (Apple Silicon, macOS 26): hosting and rendering match Pake (title, walk, hall models over `mygo://`); `mygo build` in ~11–15 s; icon from `app/favicon.svg` lands in the bundle as `AppIcon.icns`; the update closed loop replayed on this implementation — installed 0.4.0, feed switched to 0.4.1, app found → downloaded → signature verified → replaced → relaunched as 0.4.1 → up to date (log in the PR for #261). Windows/Linux cross-compile from here (~10 s each); **not yet run on those systems**.

## Replaying an update locally

The feed is the real `updatesUrl`, whose DNS cannot be pointed at a local server without admin rights; `MYGO_LOCAL_FEED` makes the app read the same manifests and archives from a local HTTPS directory instead (host rewritten only — signatures and manifests are the ones `mygo build` wrote):

```sh
# serve <feed>/update-<platform>.json under the same path layout as updatesUrl
MYGO_LOCAL_FEED="https://127.0.0.1:8443/updates/desktop" SSL_CERT_FILE=/path/ca.pem \
  "山门之外.app/Contents/MacOS/山门之外"
```

Every step is logged to `~/Library/Application Support/山门之外/update.log` (MyGo names the data directory after the display name, not the identifier).

MyGo keeps the window state in `~/Library/Application Support/<identifier>/.window-state.json`, which overrides the configured size after the first launch; delete that file to see the configured window again.
