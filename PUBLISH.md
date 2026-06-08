# Publishing

Note to self. Cutting a release = bump version, push the tag, publish to npm,
create the GitHub release.

## Steps

```sh
# 1. make sure everything is committed and green
npm run check && npm test

# 2. bump version (patch | minor | major) -> commits + creates tag vX.Y.Z
npm version patch -m "chore: release v%s"

# 3. push main + the new tag
git push --follow-tags

# 4. publish to npm (needs browser auth; run it interactively)
npm publish

# 5. create the GitHub release from the tag
gh release create v0.1.1 --generate-notes
```

## Notes

- `npm publish` uses browser-based auth. If the token is stale, `npm login`
  first. In Claude Code, run it as `! npm publish` so the browser can open.
- The npm tarball is limited by the `files` whitelist in `package.json`
  (`bin/`, `src/`, `README.md`, `LICENSE`). Check it with `npm pack --dry-run`.
- `--generate-notes` builds the changelog from commits/PRs. Swap for
  `--notes "..."` to write them by hand.
- Verify afterwards: `npm view inspect-json-cli version`.
