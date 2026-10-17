# Releasing Retend

Retend releases eight workspace packages and five native GPUI addons at the
same version. **The version is selected on `next`, and a push to `main`
publishes that exact version.** No CI bot commits to `main`.

## Cut a release

On `next`, when a release is ready:

```sh
pnpm release:bump
```

This increments the patch version across the root manifest, eight package
manifests, and five native manifests. Include a nonempty
`changelogs/X.Y.Z.md` entry for that version. Review and commit those changes
with the other release changes, then merge into `main`. The next release from
`0.0.36` is `0.0.37`. There is no bump on docs-only merges or unrelated
changes; they still receive build and test coverage.

`Publish Retend Release` runs on each merge to `main`:

1. Check whether the root version changed from the prior `main` commit.
   Run shared CI tests once (also used for pull requests).
2. If the version changed **and** `AUTO_RELEASE_ENABLED` is `true`,
   build the five native addons on macOS, Windows, and Linux, including
   shader validation and Windows packaged smoke tests.
3. Collect all five native artifacts, confirming expected directories,
   filenames and manifest versions before copying them.
4. Build JavaScript packages, pack all eight workspace tarballs, add exact
   native `optionalDependencies` to the **packed** `retend-gpui`, and run
   `npm publish --dry-run` for versions not already published.
5. Publish using npm's GitHub Actions trusted publishing. Native packages
   precede the main `retend-gpui` package. After every npm package succeeds,
   create the `vX.Y.Z` GitHub release using `changelogs/X.Y.Z.md` and five addons.

All jobs use the merge commit. No generated version commit, branch bypass,
or separate release commit is required.

A merge without a version bump does not release another npm version.
Rerunning a failed job uses the same commit/version; npm versions already
published are skipped. npm publishing is not transactional, so fix interrupted
releases before merging another version.

## One-time setup

Publishing starts **disabled**. Enable it only when ready:

1. Configure npm **Trusted Publisher** for each of the thirteen npm packages
   below: GitHub Actions owner `resuite`, repository `retend`, workflow
   filename `release.yml`. Enable **direct `npm publish`** for each trusted
   publisher (new npm trusted-publisher configurations may default to staged
   publishing only). No environment is required unless the workflow and npm
   settings both declare one.
2. Ensure GitHub Actions is permitted to create GitHub releases and tags
   (`GITHUB_TOKEN` permission `contents: write`). **No write access to the
   `main` branch is needed.** The publishing job has `id-token: write`
   for npm OIDC authentication, not a persistent npm token.
3. Set the GitHub Actions repository variable `AUTO_RELEASE_ENABLED` to
   `true` after cross-platform builds and trusted publishing have been
   verified.

| Workspace packages | GPUI native packages |
| --- | --- |
| `retend` | `retend-gpui-native-darwin-arm64` |
| `retend-web` | `retend-gpui-native-linux-arm64-gnu` |
| `retend-web-devtools` | `retend-gpui-native-linux-x64-gnu` |
| `retend-server` | `retend-gpui-native-win32-arm64-msvc` |
| `retend-utils` | `retend-gpui-native-win32-x64-msvc` |
| `retend-oxlint-plugin` | |
| `retend-gpui` | |
| `retend-start` | |

No old manual `publish-*` commands should be used. Native artifacts can
still be built independently through `Build Native Addon`'s manual workflow.

## Validate and recover

```sh
pnpm release:check
```

This lints and tests the release machinery, including workspace packing.
The full publication dry run (`pnpm release:dry-run`) requires **all five
real platform binaries** to be present; CI runs it automatically after
collecting the artifacts and before actual publishing.

If a release fails, repair the cause and **re-run the original failed
GitHub Actions workflow run**. Its event SHA and version remain fixed, even
if newer commits have reached `main`. Do not manually trigger a fresh release
from the branch tip. Published npm versions are immutable; never reuse a
version for another source commit. An existing tag or release must point to
the same commit (and existing assets must match their SHA-256 digests).
Release runs are serialized with GitHub Actions `queue: max` (up to 100
pending runs; exceeding that limit still requires manual intervention).

A successful run publishes the eight workspace packages and five platform
packages at a single version, then creates one GitHub release.
