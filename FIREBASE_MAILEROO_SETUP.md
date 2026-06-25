# Firebase + Maileroo setup

This app sends reports and photos without opening the user's email app by
posting to a Firebase Function called `sendReport`.

## Maileroo details needed

Create a Maileroo account and set up either their free sender domain or any
sender they approve for your account. Then get these SMTP details from Maileroo:

```text
SMTP username
SMTP password
From email address
```

The backend defaults to:

```text
MAILEROO_SMTP_HOST=smtp.maileroo.com
MAILEROO_SMTP_PORT=587
MAILEROO_TO=jonomcadam@hotmail.com
MAILEROO_REPLY_TO=jonomcadam@hotmail.com
```

## Firebase secrets and environment

Set the Maileroo SMTP login as Firebase secrets:

```bash
npx -y firebase-tools@latest functions:secrets:set MAILEROO_SMTP_USER
npx -y firebase-tools@latest functions:secrets:set MAILEROO_SMTP_PASS
```

Create `functions/.env` with:

```text
MAILEROO_SMTP_HOST=smtp.maileroo.com
MAILEROO_SMTP_PORT=587
MAILEROO_FROM=WDL Field Forms <FieldForms@3ee91f650f778328.maileroo.org>
MAILEROO_TO=jonomcadam@hotmail.com
MAILEROO_REPLY_TO=jonomcadam@hotmail.com
```

## Deploy

```bash
npm --prefix functions install
npx -y firebase-tools@latest deploy --only functions
```

The app should use this deployed endpoint:

```text
EXPO_PUBLIC_FIREBASE_REPORT_ENDPOINT=https://australia-southeast1-wdl-field-forms.cloudfunctions.net/sendReport
```

For GitHub Actions APK builds, add the same URL as a repository secret named:

```text
EXPO_PUBLIC_FIREBASE_REPORT_ENDPOINT
```
