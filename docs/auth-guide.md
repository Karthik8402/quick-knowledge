# Authentication Guide

Quick Knowledge uses **Supabase Auth** for user authentication. Auth is optional in local development and enforced in production.

## How Auth Works

- Frontend uses `@supabase/supabase-js` to handle sign-up, sign-in, password reset, and session management.
- Backend validates JWT tokens on every protected route using Supabase's JWT secret.
- Row-Level Security (RLS) policies in Postgres enforce data isolation by `owner_id`.
- The backend service role key bypasses RLS for server-side operations.

## Configuration

### Backend (`backend/.env`)

```ini
AUTH_ENABLED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Frontend (`frontend/.env`)

```ini
VITE_AUTH_ENABLED=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Auth Flow

```
User → Login/Register → Supabase Auth → JWT Session
       ↓
Frontend stores session → Access token injected in API requests
       ↓
Backend validates JWT → Extracts user_id → owner_id filtering
```

### Available Endpoints

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email/password sign-in |
| Register | `/register` | Create account (name, email, phone, timezone) |
| Forgot Password | `/forgot-password` | Request password reset email |
| Reset Password | `/reset-password` | Set new password from reset link |
| Auth Callback | `/auth/callback` | Handles OAuth/email verification redirects |

## Frontend Implementation

- **Auth Context** — `src/hooks/useAuth.ts` provides `user`, `session`, `loading` state across the app.
- **Protected Routes** — `ProtectedRoute` component in `App.tsx` redirects unauthenticated users to `/login`.
- **JWT Injection** — `authFetch()` in `src/api.ts` automatically attaches the Bearer token from the active session.
- **Cache Clearing** — On sign-out, the API cache, localStorage, and sessionStorage are aggressively cleared.

### Sign-out Behavior

```typescript
signOut() {
  await supabase.auth.signOut();
  clearApiCache();
  localStorage.clear();
  sessionStorage.clear();
  // Redirects to /login
}
```

## Backend Implementation

- **JWT Validation** — `app/core/auth.py` decodes and verifies the Supabase JWT using `pyjwt` with the `SUPABASE_JWT_SECRET`.
- **User Context** — `get_current_user()` dependency extracts `UserContext(user_id)` from the validated token.
- **Data Isolation** — All vector store queries include an `owner_id` filter. Document registry operations scope by `owner_id`.

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Go to **Authentication → Settings** and configure:
   - Email auth (default: enabled)
   - Site URL (e.g., `https://intelligent-knowledge.vercel.app`)
   - Redirect URLs (e.g., `https://intelligent-knowledge.vercel.app/auth/callback`)
3. Run the migration in `supabase/migrations/001_init.sql` to set up:
   - `documents` table with RLS policies
   - `pgvector` extension
4. Copy your project credentials from **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_KEY`
   - `JWT Secret` → `SUPABASE_JWT_SECRET`

## Local Development

Set `AUTH_ENABLED=false` to disable auth locally. The backend will use `"anonymous"` as the default user ID.
