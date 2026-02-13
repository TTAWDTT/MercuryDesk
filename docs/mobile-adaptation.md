# Aelin iOS/Android Adaptation

This project now includes native wrappers for iPhone and Android via Capacitor.

## What Was Added

- Capacitor config and plugins in `frontend/`
  - Android shell scheme is `http` for local-dev compatibility with `http://10.0.2.2:8000`
- Native projects:
  - `frontend/ios/`
  - `frontend/android/`
- Mobile runtime bootstrap:
  - status bar/keyboard handling
  - native shell detection
- Native routing adaptation:
  - HashRouter in native shell
- Safe-area adaptation:
  - uses `env(safe-area-inset-*)` for notch/home-indicator devices
- API base URL support for mobile:
  - `VITE_MOBILE_API_BASE_URL` (Android emulator default fallback)
  - `VITE_API_BASE_URL` (recommended for physical devices / production)

## Key Files

- `frontend/capacitor.config.ts`
- `frontend/src/mobile/runtime.ts`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/styles.css`
- `frontend/src/components/Aelin.tsx`
- `frontend/.env.mobile.example`

## Commands

Run in `frontend/`:

```bash
npm install
npm run mobile:add:ios
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open:ios
npm run mobile:open:android
```

Direct run:

```bash
npm run mobile:run:ios
npm run mobile:run:android
```

## API Base URL

For Android emulator, default fallback is:

```bash
VITE_MOBILE_API_BASE_URL=http://10.0.2.2:8000
```

Backend CORS should include native origins such as `http://localhost` and `capacitor://localhost`.

For physical devices, set:

```bash
VITE_API_BASE_URL=https://your-api-domain.com
```

Do not use `127.0.0.1` for real phones.
