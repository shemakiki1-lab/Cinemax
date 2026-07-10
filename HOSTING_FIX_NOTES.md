# Cinemax hosting fix notes

This zip is prepared for Render hosting.

## Required Render environment variables

Set these on the `cinemax-backend` web service before deploying:

- `MONGO_URI` — your MongoDB Atlas connection string.
- `JWT_SECRET` — Render can generate this automatically from `render.yaml`.
- `ADMIN_EMAIL` — `allkikisweb@gmail.com`.
- `EMAIL_USER` — `allkikisweb@gmail.com`.
- `EMAIL_APP_PASSWORD` — your Gmail App Password, entered with or without spaces.
- `TMDB_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` — for movies, visual search, and AI assistant features.

Do not commit the Gmail App Password to Git. Add it only in Render's environment variable panel.

## What changed

- Hosted website/admin fall back to `https://cinemax-backend.onrender.com` instead of localhost/same-origin static hosting.
- Backend CORS accepts configured Render service URLs and Render-hosted frontend/admin origins.
- Admin login always uses a 6-digit OTP sent to `allkikisweb@gmail.com`.
- User signup uses email OTP verification.
- Regular user login stays password-only; users are not asked for login OTP.
- Gmail App Password spaces are stripped automatically, so the Render value works whether it is pasted with or without spaces.