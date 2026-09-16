# Kilix Web - Safe Web Variant

This is a separate working copy of the Kilix Expo project prepared for Expo Web.

## Database safety
- No Supabase SQL, migrations, Edge Functions, buckets, or database records were changed by this preparation.
- The existing Supabase configuration is retained.
- The web variant uses the same application/backend configuration as the original project.
- Browser-local storage is used only as a web replacement for the native SecureStore adapter.

## Run
1. Install Node.js 20.19+.
2. Run `npm install`.
3. Run `npm run web`.

## Important
This ZIP is a web-preparation copy. Before production deployment, test all browser-specific flows, especially media upload/picking, OAuth redirects, notifications, and any native-only functionality.
