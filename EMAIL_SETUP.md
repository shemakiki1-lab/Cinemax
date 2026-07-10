# Email Setup (OTP + Forgot Password)

Sign-up OTP verification and forgot-password emails are already wired end-to-end
in `backend/src/routes/website.ts` and `backend/src/lib/mailer.ts`. They only
require a Gmail account + App Password so nodemailer can send.

## Required environment variables (Render → Environment)

| Variable            | Example value                              | Notes                                                                 |
|---------------------|--------------------------------------------|-----------------------------------------------------------------------|
| `EMAIL_USER`        | `allkikisweb@gmail.com`                    | Gmail address emails will be sent FROM.                              |
| `EMAIL_APP_PASSWORD`| `abcd efgh ijkl mnop` (spaces OK)          | Gmail **App Password** (not your normal password). See below.        |
| `ADMIN_EMAIL`       | `allkikisweb@gmail.com` *(default)*        | Optional — already defaulted in code.                                |
| `ADMIN_PASSWORD`    | `kiki@321` *(default)*                     | Optional — already defaulted in code. Override to rotate.            |

Aliases `GMAIL_USER` / `GMAIL_APP_PASSWORD` also work.

## Generating a Gmail App Password

1. Enable 2-Step Verification on the Gmail account:
   https://myaccount.google.com/security
2. Open https://myaccount.google.com/apppasswords
3. App: **Mail**, Device: **Other → "Cinemax"** → Generate.
4. Copy the 16-character token and paste it as `EMAIL_APP_PASSWORD`.

## Verify it's working

After redeploying with the env vars set:

- `GET /api/site/mailer-status` (or check server logs on boot) will report
  `configured: true`.
- Sign-up → verification code arrives at the email entered.
- Login → "Forgot password" → reset link arrives at the email entered.

If `EMAIL_USER` or `EMAIL_APP_PASSWORD` is missing, the OTP endpoint returns
`503 Email delivery isn't configured…` — that is the message from your
screenshot.

## Admin credentials (out of the box)

- Email: `allkikisweb@gmail.com`
- Password: `kiki@321`

These are seeded on every boot from `seedAdminUser()` in
`backend/src/lib/auth.ts`; if a different admin password is already stored
in `data/cinemax.json`, boot will overwrite it back to the configured
`ADMIN_PASSWORD` (default `kiki@321`), so the credentials above are
guaranteed to sign in.

## Admin redirect from the main site

When the admin signs in via the AppContext login form (`AuthModal`),
`AppContext.signIn()` now detects `user.role === "admin"` and calls
`goToAdminPanel()`, which fetches a short-lived portal token from
`/api/auth/admin-portal-url` and does a same-window redirect to the
standalone admin panel. No extra clicks, no popup blockers.
