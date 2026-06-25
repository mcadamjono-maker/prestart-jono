# Firebase + Resend setup

This app can send reports and photos without opening the user's email app by posting to a Firebase Function called `sendReport`.

## Firebase secrets and environment

Set the Resend API key as a Firebase secret:

```bash
firebase functions:secrets:set RESEND_API_KEY
```

Create `functions/.env` with:

```text
EMAIL_FROM=WDL Field Forms <forms@williamsdrainage.co.nz>
EMAIL_TO=jonomcadam@hotmail.com
REPLY_TO=jonomcadam@hotmail.com
```

The `EMAIL_FROM` address must be allowed by Resend. For live use, verify the `williamsdrainage.co.nz` domain in Resend first.

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
npm --prefix functions install
firebase deploy --only functions
```

After deployment Firebase will show a URL similar to:

```text
https://australia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/sendReport
```

Add that URL to the app environment:

```text
EXPO_PUBLIC_FIREBASE_REPORT_ENDPOINT=https://australia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/sendReport
```

For GitHub Actions APK builds, add the same URL as a repository secret named:

```text
EXPO_PUBLIC_FIREBASE_REPORT_ENDPOINT
```

Then rebuild the APK.
