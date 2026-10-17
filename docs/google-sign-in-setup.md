# Setting up Google sign-in and the community

The code is finished; these steps connect it to your own Google and Supabase accounts. None of the
values below go in the repository: the Google client secret lives only in the Supabase dashboard.

## 1. Create the community tables (Supabase)

Open **SQL Editor**, paste `supabase/migrations/20261018000000_community.sql`, and run it. (The
`transfers` migration from before must already be applied.) It creates `profiles`, `public_plans`,
`plan_reports` and `delete_my_account()`, and turns on the access rules.

## 2. Google Cloud: the consent screen and the client

1. <https://console.cloud.google.com> → create a project (any name).
2. **APIs & Services → OAuth consent screen**
   - User type **External**.
   - App name `Tracker`, a support email, a developer contact email.
   - App home page `https://<your-site>/`, privacy policy `https://<your-site>/privacy`,
     terms `https://<your-site>/terms`.
   - **Scopes:** only `openid`, `email`, `profile` (the app needs nothing more; do not add others).
   - Leave **Publishing status = Testing** while you try it. Only the test users you list (up to
     100, add your own Google address) can sign in. Switch to **In production** when you launch.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins: `https://<your-site>` and, for local tests, `http://localhost:4173`.
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
     (`<project-ref>` is the code in your Supabase dashboard address).
   - Copy the **Client ID** and **Client secret**.

> **A domain you own may be needed to go public.** Google checks that the privacy and terms links are
> on a domain you have verified. A `*.workers.dev` address is shared, so it generally cannot be
> verified. Testing mode works with it; for a public launch, attach a custom domain (about 10 EUR a
> year) to the Worker in Cloudflare and use that address everywhere above.

## 3. Supabase: switch Google on

1. **Authentication → Providers → Google**: enable, paste the Client ID and Client secret, save.
2. **Authentication → URL Configuration**
   - **Site URL**: `https://<your-site>`
   - **Redirect URLs**: add `https://<your-site>/profile` and `http://localhost:4173/profile`.

## 4. Try it

Open the site, go to **Profile → Account → Sign in with Google**, tick the agreement, and sign in.
You should come back to Profile showing `@user_xxxxxxxx`. Publish a plan from a workout page, then
look at it in **Community**.

## Looking after the community

All of this is done in the Supabase dashboard (the API cannot do it, on purpose).

- **Reports:** Table editor → `plan_reports`. Three different reporters hide a plan automatically.
- **Hidden plans:** Table editor → `public_plans`, filter `hidden = true`. To restore one:
  `update public_plans set hidden = false where id = '<id>';`. To remove one: delete the row.
- **Remove a user:** Authentication → Users → delete. Their profile, plans and reports go with them.
- **Legal requests:** people write to the contact address in the Privacy Policy. Account deletion
  is self-service in the app (Profile → Account → Delete account).

## Before you call it public

- The Privacy Policy and Terms are in `web/src/ui/Legal.tsx`, written to match what the app does.
  Check the operator name, contact address and date at the top of that file.
- They are a good-faith draft, not legal advice. If you charge money, run ads, or operate as a
  business, you may also need to show a postal address and tax details, and a lawyer should review
  the texts.
- Review the retention and third-party sections if you add analytics, a new provider, or new data.
