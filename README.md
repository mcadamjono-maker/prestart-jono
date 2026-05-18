Serverless email prototype (Netlify)

Overview
- Netlify function `sendChecklist` sends form data via SendGrid. The client converts the photo to base64 and POSTs JSON to the function.

Setup
1. Install deps locally:

```bash
npm install
```

2. Add environment variables in Netlify (Site settings -> Build & deploy -> Environment):
- `SENDGRID_API_KEY` — your SendGrid API key
- `SENDER_EMAIL` — verified sender (e.g. noreply@yourdomain.com)
- `RECIPIENT_EMAIL` — address to receive checklists

3. Deploy the repo to Netlify (connect Git provider) or use `netlify deploy`.

Notes
- If you don't have a SendGrid key, you can sign up for a free account and create an API key.
- For testing without SendGrid, the function returns an error indicating the missing key; you can mock the endpoint locally.
