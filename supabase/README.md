# Supabase Edge Functions

Edge Function source for coworkingprilep.mk. The website's pre-launch email
form posts to the `subscribe` function, which inserts the row and triggers a
Resend-powered thank-you email.

## Deploying `subscribe`

### One-time setup

1. Install the Supabase CLI (`brew install supabase/tap/supabase`).
2. From the repo root: `supabase login` (browser auth flow).
3. Link this folder to the project once:
   ```
   supabase link --project-ref iikrjwnwejliupiwrnpy
   ```

### Set the secrets

Run once (or whenever a secret rotates). **Never commit these values to git.**

```
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  FROM_ADDRESS=onboarding@resend.dev \
  FROM_NAME="Coworking Prilep"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Edge
runtime — don't set those manually.

When the custom domain (e.g. `hello@coworkingprilep.mk`) is verified in
Resend, swap the `FROM_ADDRESS` secret and the next deploy picks it up:

```
supabase secrets set FROM_ADDRESS=hello@coworkingprilep.mk
```

### Deploy

```
supabase functions deploy subscribe --no-verify-jwt
```

`--no-verify-jwt` lets anonymous visitors call the function from the website
form. RLS + input validation inside the function keep it safe.

### Test

```
curl -i -X POST \
  https://iikrjwnwejliupiwrnpy.supabase.co/functions/v1/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_publishable_ARIm4r9R-t0YCn-W91A6yw_qRuMm1Ra" \
  -d '{"email":"test@example.com","source":"curl"}'
```

Expected response:
```
{"ok":true,"duplicate":false,"emailSent":true}
```

### Logs

```
supabase functions logs subscribe --tail
```

## Alternative: deploying without the CLI

If the CLI is not installed, paste `functions/subscribe/index.ts` into the
Supabase Dashboard → **Edge Functions** → **New Function** → name `subscribe`
→ paste the file → **Deploy**. Then set the same secrets under
**Edge Functions → Manage Secrets**.
