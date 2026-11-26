# Jugnu — har yaad, ek roshni

A reminder app for anything (medicines, gym, bills, birthdays) that rings like a real alarm clock.
Android only. Expo SDK 58 / React Native 0.88, with a small native module for the alarms.

## How it works

- **Routines** ring their items one after another, `gap` minutes apart, from a start time.
  A late answer pushes the rest of the routine so the gap is always kept; a snooze does the same.
  Items can also have their **own time** outside the chain (the two hair items do).
- **Reminders** are one-item routines with a repeat: daily, some weekdays, monthly, yearly or once.
- The JS side (`src/core/schedule.ts`) works out every ring for the next 7 days and hands the list to
  Android (`modules/jugnu-alarm`). Android rings with `setAlarmClock` + a full-screen, insistent
  notification, re-rings up to N times if nobody answers, and restores alarms after a reboot.

## Layout

```
src/app/            screens (expo-router): Today, Routines, History, Settings, alarm, setup, editors
src/core/           types, seed (the prescription), schedule rules, store, alarm engine
src/ui/             theme, text, icons, shared controls
modules/jugnu-alarm Kotlin: AlarmScheduler, AlarmReceiver, AlarmNotifier, BootReceiver, lock-screen handling
scripts/            test-schedule.ts (chain rules), make-icons.cjs (icon PNGs from the logo)
```

## Build and install (this PC)

The project lives at `F:\j` (short path: React Native's native build breaks past 260 characters).
`F:\Personal Project\Jugnu` is a shortcut to it.

```powershell
$env:JAVA_HOME = "F:\Mobile App\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd F:\j\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\release\app-release.apk
```

### Sharing with friends

```powershell
.\scripts\build-apk.ps1 shared     # dist\Jugnu-<version>.apk — starts empty, 32- and 64-bit phones
.\scripts\build-apk.ps1 personal   # dist\Jugnu-<version>-mine.apk — your phone, with your prescription
```

- `src/core/seed-personal.ts` holds the prescription. `scripts/use-seed.cjs` copies it (or an empty seed) into
  `src/core/seed-data.ts` before a build, so the shared APK contains no personal data at all.
- Release builds are signed with `keys/jugnu-release.jks`; its password lives in `~/.gradle/gradle.properties`
  (`JUGNU_*`). **Back up both.** Without them, friends can't install updates over their current version.
- Bump `version` and `android.versionCode` in `app.json` (and `android/app/build.gradle`) for every APK you share.

Checks: `npm run typecheck`, `npm run test:schedule`. After changing `app.json` or the native module's
manifest, run `npx expo prebuild --platform android --no-install` again.

## Jugnu AI, accounts and plans (online part)

Alarms and routines never need the internet. Signing in is only for **Jugnu AI**: scan a prescription
(`src/app/scan.tsx`) or type a reminder (`src/app/quick.tsx`). Results are always reviewed before saving
(`src/core/ai-apply.ts`).

- **Server:** the shared Supabase project (`oeqglnatffufrexhbfry`, also used by Ginti). Jugnu only adds
  `jugnu_*` tables and functions (`supabase/migrations/0001_jugnu_accounts.sql`) and the `jugnu-ai` Edge
  Function. Logins are one pool with Ginti, and Ginti's sign-up trigger also gives Jugnu users an unused
  Ginti wallet. Never overwrite the project's AI secrets: Ginti's `ai` function uses them too.
- **AI:** `jugnu-ai` uses Claude (`ANTHROPIC_API_KEY`), then Gemini (`GEMINI_API_KEY`) when Claude can't
  answer. The keys stay in Supabase secrets, never in the APK.
- **Plans:** new users get a free trial (`trial_days`, default 30). After payment by UPI or cash, the admin
  gives Jugnu Pro from the in-app **Admin** screen (Settings → Admin), with the amount and method recorded.
  `daily_limit` caps AI use per person per day. Admins come from `jugnu_admin_emails`.
- **Set up / update the server:** `bash scripts/setup-cloud.sh <admin-email>` (safe to re-run).
- **Google sign-in (one time, in the browser):**
  1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID →
     *Web application*. Authorised redirect URI: `https://oeqglnatffufrexhbfry.supabase.co/auth/v1/callback`.
  2. Supabase dashboard → Authentication → Sign In / Providers → Google → turn on, paste the client ID and secret.
  3. Supabase → Authentication → URL Configuration → Redirect URLs → add `jugnu://**`.
     Leave the Site URL as it is (Ginti needs it).
- The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`
  (public values, the same as Ginti's).
