# OAuth sign-in test matrix

Manual verification checklist for Galdr OAuth-only auth. Requires Clerk Dashboard configuration per [clerk-dashboard-setup.md](./clerk-dashboard-setup.md).

## Modal sign-in (no page pass-through)

From each page (`/`, `/registry`, `/staves/[id]`):

- [ ] Click **Sign in** — Clerk modal opens on current page (no navigation to `/sign-in`)
- [ ] Galdr page stays visible underneath the modal backdrop
- [ ] After OAuth popup completes, user remains on the same URL
- [ ] Username onboarding modal appears if username is unset

## Per-provider first sign-in

For each provider (GitHub, GitLab, Bitbucket, Google, Microsoft, Apple):

- [ ] New account created on first OAuth sign-in
- [ ] Username onboarding completes
- [ ] Grimoire URL resolves from username (`/grimoire/{slug}`)
- [ ] Vote, save, and comment persist under `clerkUserId`

## Provider swap (Connected account)

While signed in → account menu → **Connected account**:

- [ ] Current provider and email/status displayed
- [ ] **Change sign-in provider** lists other providers only (not current)
- [ ] After swap: old provider cannot sign in to this account
- [ ] New provider signs in to same account (same data, same `clerkUserId`)
- [ ] Attempt to link a provider already used by another account shows a clear error

## Route protection

While signed out:

- [ ] `/library` redirects to sign-in (Clerk protect)
- [ ] `/grimoire` redirects to sign-in
- [ ] `/settings` redirects to sign-in
- [ ] POST `/api/staves/[id]/vote` returns 401

## Callback routes (not user-facing)

- [ ] `/sign-up` redirects to `/`
- [ ] `/sign-in` loads only when hit directly (OAuth callback); not linked from UI

## Automated checks (CI-local)

```bash
npm run lint
npm run build
```
