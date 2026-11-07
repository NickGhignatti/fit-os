# Tracker (fit-os)

The app is a PWA in `web/` (React, TypeScript, Vite). Run `npm test` and `npm run typecheck` from `web/` before committing; the
Cloudflare build runs the tests too, so a failing or flaky test breaks the deploy.

## Commit messages are release notes

The app has a megaphone on Today ("What's new") that lists what changed in each version. Its text is **the body of the
commit message**, read from git at build time (`web/changelog.ts`); the first line is not shown. Every commit that changes
what people see or can do therefore needs a body written **for the people who use the app**, not for developers.

- First line: a short developer-facing summary, as usual.
- Body (after a blank line): one to three short paragraphs, in English, in plain language, saying what is new or fixed and
  what it means for the person. Lead with the benefit ("You can now…", "Sets no longer…"), name the screen or button where
  they will find it, and use the words the app uses.
- No file names, function names, internal jargon, or ticket numbers.
- Keep it honest and specific: what changed, and what to do differently if anything. No hype.
- A commit with an empty body is simply not announced. Use that on purpose for changes users cannot see (tests, refactors,
  build and tooling): write only the first line.
- Trailers at the very end of a message (such as `Co-Authored-By:`) are dropped from what people read.
- Commits made before 2026-11-07 12:05 (+01:00) are not announced; see `CHANGELOG_SINCE` in `web/changelog.ts`.

Example:

```
Review a training plan before importing it

When you import a plan from a file or from an AI's answer, you now see it laid out day by day first. Change the weights and
rest times for one exercise or for all of them at once, remove what you don't want, then tap Import plan. Nothing is saved
until you do.
```

Commit and push straight to `master` once the change is verified.
