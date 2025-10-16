# Round Robin Roping - Cloud Sync Implementation Plan

**Document Version:** 1.0
**Date:** October 15, 2025
**Estimated Timeline:** 8-10 weeks (part-time, 10-15 hours/week)
**Goal:** Transform local-only PWA into cloud-synced, multi-tenant SaaS application

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Supabase Setup](#phase-1-supabase-setup)
3. [Phase 2: Database Schema Migration](#phase-2-database-schema-migration)
4. [Phase 3: Authentication Implementation](#phase-3-authentication-implementation)
5. [Phase 4: Sync Layer Development](#phase-4-sync-layer-development)
6. [Phase 5: Conflict Resolution](#phase-5-conflict-resolution)
7. [Phase 6: Payment Integration](#phase-6-payment-integration)
8. [Phase 7: UI Updates](#phase-7-ui-updates)
9. [Phase 8: Testing Strategy](#phase-8-testing-strategy)
10. [Phase 9: Deployment](#phase-9-deployment)
11. [Phase 10: Migration Plan](#phase-10-migration-plan)
12. [File-by-File Changes](#file-by-file-changes)
13. [Code Examples](#code-examples)
14. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

### Architecture Change

**Current Architecture (Local-Only):**
```
┌─────────────────┐
│   Browser UI    │
└────────┬────────┘
         │
┌────────▼────────┐
│   IndexedDB     │
│   (Dexie.js)    │
└─────────────────┘
```

**New Architecture (Cloud-Synced):**
```
┌─────────────────┐
│   Browser UI    │
└────────┬────────┘
         │
┌────────▼────────┐      ┌──────────────┐
│   IndexedDB     │◄────►│  Sync Layer  │
│   (Dexie.js)    │      └──────┬───────┘
└─────────────────┘             │
                                │
                      ┌─────────▼──────────┐
                      │   Supabase Cloud   │
                      │  ┌──────────────┐  │
                      │  │ PostgreSQL   │  │
                      │  ├──────────────┤  │
                      │  │ Auth         │  │
                      │  ├──────────────┤  │
                      │  │ Realtime     │  │
                      │  └──────────────┘  │
                      └────────────────────┘
```

### Key Principles

1. **Local-First**: IndexedDB remains primary data source for UI
2. **Offline Capable**: All features work offline, sync when online
3. **Progressive Enhancement**: Existing offline-only functionality preserved
4. **Data Security**: User data isolated via Row Level Security (RLS)
5. **Backward Compatible**: Existing local data migrated to cloud seamlessly

---

## Phase 1: Supabase Setup

**Timeline:** Week 1 (3-5 hours)
**Dependencies:** None
**Difficulty:** Easy

### 1.1 Create Supabase Account

1. Visit [supabase.com](https://supabase.com)
2. Sign up with GitHub (recommended) or email
3. Create new project:
   - Name: "roundrobin-roping"
   - Database password: Generate strong password (save securely!)
   - Region: Choose closest to your users (US West for western US)
4. Wait 2-3 minutes for project provisioning

### 1.2 Save Project Credentials

From Supabase dashboard → Settings → API:

```javascript
// Save these in a new file: js/config.js
const supabaseConfig = {
  url: 'https://xxxxx.supabase.co', // Your project URL
  anonKey: 'eyJhbGc...', // Your anon/public key (safe for client-side)
  serviceKey: 'eyJhbGc...' // Service role key (NEVER expose client-side!)
};
```

**Security Note:**
- `anonKey` is safe to include in your client-side code
- `serviceKey` should NEVER be in client code (only use in server functions)
- Supabase Row Level Security (RLS) protects data even with exposed anonKey

### 1.3 Install Supabase Client Library

Add to your `index.html` before other scripts:

```html
<!-- Supabase JS Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Or install via npm if you add a build step later:
```bash
npm install @supabase/supabase-js
```

### 1.4 Initialize Supabase Client

Create new file `js/supabase.js`:

```javascript
/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client for authentication and database access
 */

const supabaseUrl = 'https://xxxxx.supabase.co'; // Replace with your URL
const supabaseAnonKey = 'eyJhbGc...'; // Replace with your anon key

// Initialize Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Export for use in other files
window.supabase = supabase;

console.log('Supabase client initialized');
```

### 1.5 Test Connection

Add to `index.html` after loading `supabase.js`:

```javascript
// Test Supabase connection
supabase.from('_test').select('*').then(result => {
  console.log('Supabase connection successful:', result);
}).catch(error => {
  console.error('Supabase connection failed:', error);
});
```

---

## Phase 2: Database Schema Migration

**Timeline:** Week 1-2 (4-6 hours)
**Dependencies:** Phase 1 complete
**Difficulty:** Medium

### 2.1 Understanding Schema Changes

Your IndexedDB schema needs to be replicated in PostgreSQL with these additions:

1. **User ownership**: Add `user_id` to all tables
2. **Sync tracking**: Add timestamps for conflict resolution
3. **Soft deletes**: Already implemented in IndexedDB
4. **Unique constraints**: Prevent duplicate syncs

### 2.2 Create Supabase Tables

Go to Supabase Dashboard → SQL Editor → New Query

#### Create Users Profile Table (Optional but Recommended)

```sql
-- Extends Supabase auth.users with custom profile data
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_status TEXT DEFAULT 'free', -- 'free', 'pro', 'organization'
  subscription_id TEXT, -- Stripe subscription ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

#### Create Ropers Table

```sql
CREATE TABLE public.ropers (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- User ownership
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Original fields
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('header', 'heeler', 'both')),
  skill_level INTEGER NOT NULL CHECK (skill_level >= 1 AND skill_level <= 10),

  -- Soft delete
  deleted BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for faster queries
  UNIQUE(user_id, name, deleted) -- Prevent duplicate names per user
);

-- Enable Row Level Security
ALTER TABLE public.ropers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own ropers
CREATE POLICY "Users can view own ropers"
  ON public.ropers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own ropers
CREATE POLICY "Users can insert own ropers"
  ON public.ropers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own ropers
CREATE POLICY "Users can update own ropers"
  ON public.ropers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own ropers
CREATE POLICY "Users can delete own ropers"
  ON public.ropers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ropers_updated_at
  BEFORE UPDATE ON public.ropers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for performance
CREATE INDEX ropers_user_id_idx ON public.ropers(user_id);
CREATE INDEX ropers_deleted_idx ON public.ropers(deleted);
```

#### Create Events Table

```sql
CREATE TABLE public.events (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- User ownership
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Original fields
  name TEXT NOT NULL,
  date DATE NOT NULL,
  roper_ids BIGINT[] NOT NULL DEFAULT '{}', -- Array of roper IDs
  pairings JSONB NOT NULL DEFAULT '[]', -- Array of pairing objects
  penalties JSONB NOT NULL DEFAULT '[
    {"name": "One Leg", "seconds": 5},
    {"name": "Barrier", "seconds": 5}
  ]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policies (same pattern as ropers)
CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: Update updated_at
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX events_user_id_idx ON public.events(user_id);
CREATE INDEX events_date_idx ON public.events(date);
CREATE INDEX events_status_idx ON public.events(status);
```

#### Create Runs Table

```sql
CREATE TABLE public.runs (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- User ownership
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Foreign keys
  event_id BIGINT REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  header_id BIGINT REFERENCES public.ropers(id) NOT NULL,
  heeler_id BIGINT REFERENCES public.ropers(id) NOT NULL,

  -- Run data
  time NUMERIC(10, 3), -- Time in seconds (3 decimal places)
  raw_time NUMERIC(10, 3), -- Time before penalties
  penalties BOOLEAN[] DEFAULT '{}', -- Array of penalty flags
  round INTEGER NOT NULL DEFAULT 1,
  completed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own runs"
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own runs"
  ON public.runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs"
  ON public.runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own runs"
  ON public.runs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: Update updated_at
CREATE TRIGGER runs_updated_at
  BEFORE UPDATE ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX runs_user_id_idx ON public.runs(user_id);
CREATE INDEX runs_event_id_idx ON public.runs(event_id);
CREATE INDEX runs_completed_idx ON public.runs(completed);
```

### 2.3 Verify Tables Created

In Supabase Dashboard → Table Editor, you should see:
- `profiles`
- `ropers`
- `events`
- `runs`

Click into each table to verify columns match the schema.

### 2.4 Update IndexedDB Schema

Modify `js/db.js` to add sync tracking fields:

```javascript
// Add new version for sync fields
db.version(5).stores({
    ropers: '++id, name, position, skillLevel, cloudId, syncStatus',
    events: '++id, name, date, createdAt, cloudId, syncStatus',
    runs: '++id, eventId, headerId, heelerId, time, round, cloudId, syncStatus',
    syncQueue: '++id, table, operation, status, createdAt' // NEW TABLE
}).upgrade(tx => {
    // Add sync fields to existing records
    return Promise.all([
        tx.table('ropers').toCollection().modify(roper => {
            if (!roper.cloudId) roper.cloudId = null;
            if (!roper.syncStatus) roper.syncStatus = 'pending';
            if (!roper.localModifiedAt) roper.localModifiedAt = roper.createdAt || new Date();
        }),
        tx.table('events').toCollection().modify(event => {
            if (!event.cloudId) event.cloudId = null;
            if (!event.syncStatus) event.syncStatus = 'pending';
            if (!event.localModifiedAt) event.localModifiedAt = event.createdAt || new Date();
        }),
        tx.table('runs').toCollection().modify(run => {
            if (!run.cloudId) run.cloudId = null;
            if (!run.syncStatus) run.syncStatus = 'pending';
            if (!run.localModifiedAt) run.localModifiedAt = new Date();
        })
    ]);
});
```

---

## Phase 3: Authentication Implementation

**Timeline:** Week 2-3 (6-8 hours)
**Dependencies:** Phase 1 & 2 complete
**Difficulty:** Medium

### 3.1 Create Authentication State Manager

Create new file `js/auth.js`:

```javascript
/**
 * Authentication Manager
 *
 * Handles user authentication state, login, signup, and session management
 */

const authManager = {
    currentUser: null,

    /**
     * Initialize auth state on app load
     */
    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            this.currentUser = session.user;
            this.onAuthStateChange('SIGNED_IN', session);
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            this.onAuthStateChange(event, session);
        });
    },

    /**
     * Handle auth state changes
     */
    onAuthStateChange(event, session) {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session) {
            this.currentUser = session.user;
            this.onLogin(session.user);
        } else if (event === 'SIGNED_OUT') {
            this.currentUser = null;
            this.onLogout();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
        }
    },

    /**
     * Called when user logs in
     */
    async onLogin(user) {
        console.log('User logged in:', user.email);

        // Update UI
        this.updateAuthUI(true);

        // Start initial sync
        if (window.syncManager) {
            await syncManager.performFullSync();
        }

        // Navigate to home
        if (window.router) {
            router.navigate('home');
        }
    },

    /**
     * Called when user logs out
     */
    onLogout() {
        console.log('User logged out');

        // Update UI
        this.updateAuthUI(false);

        // Optionally clear local data (or keep for offline use)
        // await this.clearLocalData();

        // Navigate to login
        if (window.router) {
            router.navigate('login');
        }
    },

    /**
     * Update UI based on auth state
     */
    updateAuthUI(isLoggedIn) {
        const authRequired = document.querySelectorAll('.auth-required');
        const authHidden = document.querySelectorAll('.auth-hidden');

        authRequired.forEach(el => {
            el.style.display = isLoggedIn ? 'block' : 'none';
        });

        authHidden.forEach(el => {
            el.style.display = isLoggedIn ? 'none' : 'block';
        });

        // Update user info display
        const userEmail = document.getElementById('user-email');
        if (userEmail) {
            userEmail.textContent = this.currentUser?.email || '';
        }
    },

    /**
     * Sign up new user
     */
    async signUp(email, password, fullName) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            app.showNotification('Account created! Check your email to verify.', 'success');
            return { success: true, data };
        } catch (error) {
            console.error('Signup error:', error);
            app.showNotification(error.message, 'error');
            return { success: false, error };
        }
    },

    /**
     * Sign in existing user
     */
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            app.showNotification('Welcome back!', 'success');
            return { success: true, data };
        } catch (error) {
            console.error('Login error:', error);
            app.showNotification(error.message, 'error');
            return { success: false, error };
        }
    },

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            app.showNotification('Signed out successfully', 'success');
            return { success: true };
        } catch (error) {
            console.error('Signout error:', error);
            app.showNotification(error.message, 'error');
            return { success: false, error };
        }
    },

    /**
     * Send password reset email
     */
    async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#reset-password`
            });

            if (error) throw error;

            app.showNotification('Password reset email sent!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            app.showNotification(error.message, 'error');
            return { success: false, error };
        }
    },

    /**
     * Update password (when user clicks link in email)
     */
    async updatePassword(newPassword) {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            app.showNotification('Password updated successfully!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Password update error:', error);
            app.showNotification(error.message, 'error');
            return { success: false, error };
        }
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Clear local data (optional - use when user logs out)
     */
    async clearLocalData() {
        const confirmed = confirm('Clear all local data? This cannot be undone.');
        if (confirmed) {
            await dbHelpers.clearAllData();
            app.showNotification('Local data cleared', 'info');
        }
    }
};

// Export globally
window.authManager = authManager;
```

### 3.2 Create Login/Signup UI

Add to `index.html` after the existing pages:

```html
<!-- Login Page -->
<div id="login-page" class="page min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Round Robin Roping
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
                Sign in to sync your data across devices
            </p>
        </div>

        <form id="login-form" class="mt-8 space-y-6">
            <div class="rounded-md shadow-sm -space-y-px">
                <div>
                    <label for="login-email" class="sr-only">Email address</label>
                    <input id="login-email" name="email" type="email" required
                           class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                           placeholder="Email address">
                </div>
                <div>
                    <label for="login-password" class="sr-only">Password</label>
                    <input id="login-password" name="password" type="password" required
                           class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                           placeholder="Password">
                </div>
            </div>

            <div class="flex items-center justify-between">
                <div class="text-sm">
                    <a href="#forgot-password" class="font-medium text-blue-600 hover:text-blue-500">
                        Forgot password?
                    </a>
                </div>
            </div>

            <div>
                <button type="submit"
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Sign in
                </button>
            </div>

            <div class="text-center">
                <span class="text-sm text-gray-600">Don't have an account?</span>
                <a href="#signup" class="font-medium text-blue-600 hover:text-blue-500 ml-1">
                    Sign up
                </a>
            </div>

            <div class="text-center">
                <button type="button" id="continue-offline-btn"
                        class="text-sm text-gray-600 hover:text-gray-900">
                    Continue offline (no sync)
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Signup Page -->
<div id="signup-page" class="page min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Create Account
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
                Start syncing your roping data
            </p>
        </div>

        <form id="signup-form" class="mt-8 space-y-6">
            <div class="rounded-md shadow-sm space-y-3">
                <div>
                    <label for="signup-name" class="sr-only">Full Name</label>
                    <input id="signup-name" name="name" type="text" required
                           class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                           placeholder="Full Name">
                </div>
                <div>
                    <label for="signup-email" class="sr-only">Email address</label>
                    <input id="signup-email" name="email" type="email" required
                           class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                           placeholder="Email address">
                </div>
                <div>
                    <label for="signup-password" class="sr-only">Password</label>
                    <input id="signup-password" name="password" type="password" required minlength="6"
                           class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                           placeholder="Password (min 6 characters)">
                </div>
            </div>

            <div>
                <button type="submit"
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Create Account
                </button>
            </div>

            <div class="text-center">
                <span class="text-sm text-gray-600">Already have an account?</span>
                <a href="#login" class="font-medium text-blue-600 hover:text-blue-500 ml-1">
                    Sign in
                </a>
            </div>
        </form>
    </div>
</div>

<!-- Forgot Password Page -->
<div id="forgot-password-page" class="page min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Reset Password
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
                Enter your email to receive a reset link
            </p>
        </div>

        <form id="forgot-password-form" class="mt-8 space-y-6">
            <div>
                <label for="reset-email" class="sr-only">Email address</label>
                <input id="reset-email" name="email" type="email" required
                       class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                       placeholder="Email address">
            </div>

            <div>
                <button type="submit"
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Send Reset Link
                </button>
            </div>

            <div class="text-center">
                <a href="#login" class="font-medium text-blue-600 hover:text-blue-500">
                    Back to login
                </a>
            </div>
        </form>
    </div>
</div>
```

### 3.3 Create Login Page Handler

Create new file `js/pages/login.js`:

```javascript
/**
 * Login Page Handler
 */

const loginPage = {
    async load() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const result = await authManager.signIn(email, password);

            if (result.success) {
                // Auth manager handles navigation
            }
        });

        // Continue offline button
        const offlineBtn = document.getElementById('continue-offline-btn');
        offlineBtn.addEventListener('click', () => {
            router.navigate('home');
        });
    }
};

// Register page load handler
document.addEventListener('pageLoaded', (e) => {
    if (e.detail.page === 'login') {
        loginPage.load();
    }
});
```

Create similar files for signup and forgot-password pages.

### 3.4 Update Router to Check Auth

Modify `js/router.js`:

```javascript
// Add auth check before navigating to protected pages
navigate(page) {
    // Pages that don't require auth
    const publicPages = ['login', 'signup', 'forgot-password'];

    // If page requires auth and user not logged in, redirect to login
    if (!publicPages.includes(page) && !authManager.isAuthenticated()) {
        // Allow offline mode - show warning but allow access
        const allowOffline = confirm('You are not signed in. Continue offline? (Data will not sync)');
        if (!allowOffline) {
            page = 'login';
        }
    }

    // Rest of existing navigate logic...
}
```

---

## Phase 4: Sync Layer Development

**Timeline:** Week 3-5 (10-15 hours)
**Dependencies:** Phase 1-3 complete
**Difficulty:** Hard

### 4.1 Create Sync Manager

Create new file `js/sync.js`:

```javascript
/**
 * Sync Manager
 *
 * Handles bidirectional sync between IndexedDB and Supabase
 */

const syncManager = {
    isSyncing: false,
    lastSyncTime: null,
    syncInterval: null,

    /**
     * Initialize sync manager
     */
    async init() {
        // Load last sync time from localStorage
        this.lastSyncTime = localStorage.getItem('lastSyncTime');

        // Set up periodic sync every 30 seconds when online
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && authManager.isAuthenticated()) {
                this.performIncrementalSync();
            }
        }, 30000); // 30 seconds

        // Sync when coming back online
        window.addEventListener('online', () => {
            if (authManager.isAuthenticated()) {
                this.performIncrementalSync();
            }
        });

        console.log('Sync manager initialized');
    },

    /**
     * Perform full sync (push all local data, pull all cloud data)
     * Used on first login
     */
    async performFullSync() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return;
        }

        console.log('Starting full sync...');
        this.isSyncing = true;
        this.updateSyncStatus('Syncing...');

        try {
            // Step 1: Push all local data to cloud
            await this.pushLocalData();

            // Step 2: Pull all cloud data
            await this.pullCloudData();

            // Step 3: Update last sync time
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);

            console.log('Full sync complete');
            this.updateSyncStatus('Synced');
            app.showNotification('Data synced successfully', 'success');
        } catch (error) {
            console.error('Full sync failed:', error);
            this.updateSyncStatus('Sync failed');
            app.showNotification('Sync failed: ' + error.message, 'error');
        } finally {
            this.isSyncing = false;
        }
    },

    /**
     * Perform incremental sync (only sync changes since last sync)
     * Used for background sync
     */
    async performIncrementalSync() {
        if (this.isSyncing) return;

        console.log('Starting incremental sync...');
        this.isSyncing = true;

        try {
            // Push pending local changes
            await this.processSyncQueue();

            // Pull recent cloud changes
            await this.pullRecentCloudChanges();

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);

            this.updateSyncStatus('Synced');
        } catch (error) {
            console.error('Incremental sync failed:', error);
            this.updateSyncStatus('Sync failed');
        } finally {
            this.isSyncing = false;
        }
    },

    /**
     * Push all local data to cloud (for initial sync)
     */
    async pushLocalData() {
        const userId = authManager.getCurrentUser()?.id;
        if (!userId) throw new Error('User not authenticated');

        // Sync ropers
        const ropers = await db.ropers.toArray();
        for (const roper of ropers.filter(r => !r.deleted)) {
            if (!roper.cloudId) {
                await this.pushRoper(roper, userId);
            }
        }

        // Sync events
        const events = await db.events.toArray();
        for (const event of events) {
            if (!event.cloudId) {
                await this.pushEvent(event, userId);
            }
        }

        // Sync runs
        const runs = await db.runs.toArray();
        for (const run of runs) {
            if (!run.cloudId) {
                await this.pushRun(run, userId);
            }
        }
    },

    /**
     * Push a single roper to cloud
     */
    async pushRoper(roper, userId) {
        try {
            const { data, error } = await supabase
                .from('ropers')
                .insert({
                    user_id: userId,
                    name: roper.name,
                    position: roper.position,
                    skill_level: roper.skillLevel,
                    deleted: roper.deleted || false,
                    created_at: roper.createdAt || new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            // Update local record with cloud ID
            await db.ropers.update(roper.id, {
                cloudId: data.id,
                syncStatus: 'synced',
                cloudModifiedAt: data.updated_at
            });

            console.log('Pushed roper:', roper.name);
        } catch (error) {
            console.error('Failed to push roper:', error);
            await db.ropers.update(roper.id, {
                syncStatus: 'error'
            });
        }
    },

    /**
     * Push a single event to cloud
     */
    async pushEvent(event, userId) {
        try {
            const { data, error } = await supabase
                .from('events')
                .insert({
                    user_id: userId,
                    name: event.name,
                    date: event.date,
                    roper_ids: event.roperIds || [],
                    pairings: event.pairings || [],
                    penalties: event.penalties || [],
                    status: event.status || 'active',
                    created_at: event.createdAt || new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            await db.events.update(event.id, {
                cloudId: data.id,
                syncStatus: 'synced',
                cloudModifiedAt: data.updated_at
            });

            console.log('Pushed event:', event.name);
        } catch (error) {
            console.error('Failed to push event:', error);
            await db.events.update(event.id, {
                syncStatus: 'error'
            });
        }
    },

    /**
     * Push a single run to cloud
     */
    async pushRun(run, userId) {
        try {
            // Get cloud IDs for related records
            const event = await db.events.get(run.eventId);
            const header = await db.ropers.get(run.headerId);
            const heeler = await db.ropers.get(run.heelerId);

            if (!event?.cloudId || !header?.cloudId || !heeler?.cloudId) {
                console.warn('Cannot push run - related records not synced yet');
                return;
            }

            const { data, error } = await supabase
                .from('runs')
                .insert({
                    user_id: userId,
                    event_id: event.cloudId,
                    header_id: header.cloudId,
                    heeler_id: heeler.cloudId,
                    time: run.time,
                    raw_time: run.rawTime,
                    penalties: run.penalties || [],
                    round: run.round || 1,
                    completed: run.completed || false,
                    recorded_at: run.recordedAt,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            await db.runs.update(run.id, {
                cloudId: data.id,
                syncStatus: 'synced',
                cloudModifiedAt: data.updated_at
            });

            console.log('Pushed run:', run.id);
        } catch (error) {
            console.error('Failed to push run:', error);
            await db.runs.update(run.id, {
                syncStatus: 'error'
            });
        }
    },

    /**
     * Pull all cloud data (for initial sync)
     */
    async pullCloudData() {
        await this.pullCloudRopers();
        await this.pullCloudEvents();
        await this.pullCloudRuns();
    },

    /**
     * Pull ropers from cloud
     */
    async pullCloudRopers() {
        const { data, error } = await supabase
            .from('ropers')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        for (const cloudRoper of data) {
            // Check if already exists locally
            const existing = await db.ropers
                .where('cloudId')
                .equals(cloudRoper.id)
                .first();

            if (!existing) {
                // Insert new roper
                await db.ropers.add({
                    name: cloudRoper.name,
                    position: cloudRoper.position,
                    skillLevel: cloudRoper.skill_level,
                    deleted: cloudRoper.deleted,
                    createdAt: new Date(cloudRoper.created_at),
                    cloudId: cloudRoper.id,
                    syncStatus: 'synced',
                    cloudModifiedAt: cloudRoper.updated_at
                });
            } else {
                // Update existing if cloud is newer
                if (new Date(cloudRoper.updated_at) > new Date(existing.cloudModifiedAt)) {
                    await db.ropers.update(existing.id, {
                        name: cloudRoper.name,
                        position: cloudRoper.position,
                        skillLevel: cloudRoper.skill_level,
                        deleted: cloudRoper.deleted,
                        syncStatus: 'synced',
                        cloudModifiedAt: cloudRoper.updated_at
                    });
                }
            }
        }

        console.log(`Pulled ${data.length} ropers from cloud`);
    },

    /**
     * Pull events from cloud
     */
    async pullCloudEvents() {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        for (const cloudEvent of data) {
            const existing = await db.events
                .where('cloudId')
                .equals(cloudEvent.id)
                .first();

            if (!existing) {
                await db.events.add({
                    name: cloudEvent.name,
                    date: cloudEvent.date,
                    roperIds: cloudEvent.roper_ids,
                    pairings: cloudEvent.pairings,
                    penalties: cloudEvent.penalties,
                    status: cloudEvent.status,
                    createdAt: new Date(cloudEvent.created_at),
                    cloudId: cloudEvent.id,
                    syncStatus: 'synced',
                    cloudModifiedAt: cloudEvent.updated_at
                });
            } else {
                if (new Date(cloudEvent.updated_at) > new Date(existing.cloudModifiedAt)) {
                    await db.events.update(existing.id, {
                        name: cloudEvent.name,
                        date: cloudEvent.date,
                        roperIds: cloudEvent.roper_ids,
                        pairings: cloudEvent.pairings,
                        penalties: cloudEvent.penalties,
                        status: cloudEvent.status,
                        syncStatus: 'synced',
                        cloudModifiedAt: cloudEvent.updated_at
                    });
                }
            }
        }

        console.log(`Pulled ${data.length} events from cloud`);
    },

    /**
     * Pull runs from cloud
     */
    async pullCloudRuns() {
        const { data, error } = await supabase
            .from('runs')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        for (const cloudRun of data) {
            // Map cloud IDs to local IDs
            const event = await db.events.where('cloudId').equals(cloudRun.event_id).first();
            const header = await db.ropers.where('cloudId').equals(cloudRun.header_id).first();
            const heeler = await db.ropers.where('cloudId').equals(cloudRun.heeler_id).first();

            if (!event || !header || !heeler) {
                console.warn('Cannot sync run - related records not found');
                continue;
            }

            const existing = await db.runs
                .where('cloudId')
                .equals(cloudRun.id)
                .first();

            if (!existing) {
                await db.runs.add({
                    eventId: event.id,
                    headerId: header.id,
                    heelerId: heeler.id,
                    time: cloudRun.time,
                    rawTime: cloudRun.raw_time,
                    penalties: cloudRun.penalties,
                    round: cloudRun.round,
                    completed: cloudRun.completed,
                    recordedAt: cloudRun.recorded_at,
                    cloudId: cloudRun.id,
                    syncStatus: 'synced',
                    cloudModifiedAt: cloudRun.updated_at
                });
            } else {
                if (new Date(cloudRun.updated_at) > new Date(existing.cloudModifiedAt)) {
                    await db.runs.update(existing.id, {
                        time: cloudRun.time,
                        rawTime: cloudRun.raw_time,
                        penalties: cloudRun.penalties,
                        completed: cloudRun.completed,
                        recordedAt: cloudRun.recorded_at,
                        syncStatus: 'synced',
                        cloudModifiedAt: cloudRun.updated_at
                    });
                }
            }
        }

        console.log(`Pulled ${data.length} runs from cloud`);
    },

    /**
     * Pull only recent changes from cloud (for incremental sync)
     */
    async pullRecentCloudChanges() {
        if (!this.lastSyncTime) {
            return this.pullCloudData();
        }

        // Pull ropers modified since last sync
        const { data: ropers } = await supabase
            .from('ropers')
            .select('*')
            .gt('updated_at', this.lastSyncTime);

        // Same pull logic as above but only for changed records
        // ... (similar to pullCloudRopers but filtered)
    },

    /**
     * Process sync queue (push pending local changes)
     */
    async processSyncQueue() {
        const userId = authManager.getCurrentUser()?.id;
        if (!userId) return;

        // Get all pending records
        const pendingRopers = await db.ropers.where('syncStatus').equals('pending').toArray();
        const pendingEvents = await db.events.where('syncStatus').equals('pending').toArray();
        const pendingRuns = await db.runs.where('syncStatus').equals('pending').toArray();

        // Push each pending record
        for (const roper of pendingRopers) {
            await this.pushRoper(roper, userId);
        }

        for (const event of pendingEvents) {
            await this.pushEvent(event, userId);
        }

        for (const run of pendingRuns) {
            await this.pushRun(run, userId);
        }
    },

    /**
     * Update sync status in UI
     */
    updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    },

    /**
     * Force sync now (triggered by user button)
     */
    async forceSyncNow() {
        if (!authManager.isAuthenticated()) {
            app.showNotification('Please sign in to sync', 'info');
            return;
        }

        await this.performFullSync();
    }
};

// Export globally
window.syncManager = syncManager;
```

### 4.2 Update Database Helpers to Mark Changes

Modify `js/db.js` helper functions to mark records as needing sync:

```javascript
// Example: Update addRoper function
async addRoper(roper) {
    const id = await db.ropers.add({
        name: roper.name,
        position: roper.position,
        skillLevel: roper.skillLevel,
        deleted: false,
        createdAt: new Date(),

        // NEW: Sync tracking
        syncStatus: 'pending',
        localModifiedAt: new Date(),
        cloudId: null,
        cloudModifiedAt: null
    });

    // NEW: Trigger sync if online and authenticated
    if (navigator.onLine && authManager.isAuthenticated()) {
        syncManager.performIncrementalSync();
    }

    return id;
}

// Apply same pattern to updateRoper, deleteRoper, and all other CRUD functions
```

---

## Phase 5: Conflict Resolution

**Timeline:** Week 5-6 (4-6 hours)
**Dependencies:** Phase 4 complete
**Difficulty:** Medium

### 5.1 Implement Last Write Wins Strategy

Update sync manager to handle conflicts:

```javascript
/**
 * Merge local and cloud records using Last Write Wins strategy
 */
async mergeRecord(localRecord, cloudRecord, table) {
    const localTime = new Date(localRecord.localModifiedAt || localRecord.createdAt);
    const cloudTime = new Date(cloudRecord.updated_at);

    if (cloudTime > localTime && localRecord.syncStatus === 'pending') {
        // Cloud is newer AND local has unsaved changes - CONFLICT!
        console.warn('Conflict detected for', table, localRecord.id);

        // Option 1: Cloud wins (simple)
        await db[table].update(localRecord.id, {
            ...this.mapCloudToLocal(cloudRecord, table),
            syncStatus: 'synced',
            cloudModifiedAt: cloudRecord.updated_at
        });

        app.showNotification('Some data was updated from another device', 'info');

    } else if (cloudTime > localTime) {
        // Cloud is newer, no local changes - safe to overwrite
        await db[table].update(localRecord.id, {
            ...this.mapCloudToLocal(cloudRecord, table),
            syncStatus: 'synced',
            cloudModifiedAt: cloudRecord.updated_at
        });

    } else if (localTime > cloudTime) {
        // Local is newer - push to cloud
        await this.pushRecord(localRecord, table);
    }
    // If times are equal, do nothing
}

/**
 * Map cloud record fields to local schema
 */
mapCloudToLocal(cloudRecord, table) {
    if (table === 'ropers') {
        return {
            name: cloudRecord.name,
            position: cloudRecord.position,
            skillLevel: cloudRecord.skill_level,
            deleted: cloudRecord.deleted,
            cloudId: cloudRecord.id
        };
    } else if (table === 'events') {
        return {
            name: cloudRecord.name,
            date: cloudRecord.date,
            roperIds: cloudRecord.roper_ids,
            pairings: cloudRecord.pairings,
            penalties: cloudRecord.penalties,
            status: cloudRecord.status,
            cloudId: cloudRecord.id
        };
    }
    // ... similar for runs
}
```

### 5.2 Add Manual Conflict Resolution UI (Optional)

For better UX, show users when conflicts occur:

```javascript
/**
 * Show conflict resolution dialog
 */
async showConflictDialog(localRecord, cloudRecord, table) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl">
            <h3 class="text-lg font-bold mb-4">Data Conflict Detected</h3>
            <p class="mb-4">This record was modified on another device. Which version do you want to keep?</p>

            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="border p-4 rounded">
                    <h4 class="font-bold mb-2">This Device</h4>
                    <pre>${JSON.stringify(localRecord, null, 2)}</pre>
                </div>
                <div class="border p-4 rounded">
                    <h4 class="font-bold mb-2">Other Device</h4>
                    <pre>${JSON.stringify(cloudRecord, null, 2)}</pre>
                </div>
            </div>

            <div class="flex gap-2">
                <button id="keep-local" class="px-4 py-2 bg-blue-600 text-white rounded">
                    Keep This Device
                </button>
                <button id="keep-cloud" class="px-4 py-2 bg-gray-600 text-white rounded">
                    Keep Other Device
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    return new Promise((resolve) => {
        document.getElementById('keep-local').onclick = () => {
            document.body.removeChild(modal);
            resolve('local');
        };
        document.getElementById('keep-cloud').onclick = () => {
            document.body.removeChild(modal);
            resolve('cloud');
        };
    });
}
```

---

## Phase 6: Payment Integration

**Timeline:** Week 7 (6-8 hours)
**Dependencies:** Phase 1-5 complete
**Difficulty:** Medium

### 6.1 Set Up Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Create account
3. Complete business verification (2-3 days)
4. Get API keys from Dashboard → Developers → API keys
5. Save keys securely (add to config.js, never commit to git!)

### 6.2 Create Stripe Products

In Stripe Dashboard → Products:

1. **Pro Monthly**
   - Name: "Round Robin Roping Pro - Monthly"
   - Price: $7/month
   - Recurring: Yes

2. **Pro Annual**
   - Name: "Round Robin Roping Pro - Annual"
   - Price: $60/year
   - Recurring: Yes

Save the Price IDs (e.g., `price_xxxxx`)

### 6.3 Create Checkout Page

Create new file `js/pages/subscribe.js`:

```javascript
/**
 * Subscription/Checkout Page
 */

const subscribePage = {
    async load() {
        await this.loadUserSubscription();
        this.setupEventListeners();
    },

    async loadUserSubscription() {
        if (!authManager.isAuthenticated()) {
            router.navigate('login');
            return;
        }

        // Get user's current subscription from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status, subscription_id')
            .eq('id', authManager.getCurrentUser().id)
            .single();

        if (profile && profile.subscription_status === 'pro') {
            // Show current subscription status
            this.showSubscriptionActive();
        } else {
            // Show upgrade options
            this.showUpgradeOptions();
        }
    },

    setupEventListeners() {
        // Monthly plan button
        document.getElementById('subscribe-monthly-btn')?.addEventListener('click', () => {
            this.startCheckout('monthly');
        });

        // Annual plan button
        document.getElementById('subscribe-annual-btn')?.addEventListener('click', () => {
            this.startCheckout('annual');
        });
    },

    async startCheckout(plan) {
        const priceId = plan === 'monthly'
            ? 'price_xxxxx' // Your Stripe price ID for monthly
            : 'price_yyyyy'; // Your Stripe price ID for annual

        try {
            // Call your backend function to create checkout session
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    priceId,
                    userId: authManager.getCurrentUser().id,
                    userEmail: authManager.getCurrentUser().email
                }
            });

            if (error) throw error;

            // Redirect to Stripe Checkout
            window.location.href = data.url;

        } catch (error) {
            console.error('Checkout error:', error);
            app.showNotification('Failed to start checkout: ' + error.message, 'error');
        }
    },

    showSubscriptionActive() {
        const container = document.getElementById('subscription-content');
        container.innerHTML = `
            <div class="bg-green-100 border border-green-400 rounded-lg p-6">
                <h3 class="text-xl font-bold text-green-800 mb-2">Pro Subscription Active</h3>
                <p class="text-green-700">You have full access to all Pro features!</p>
                <button id="manage-subscription-btn" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
                    Manage Subscription
                </button>
            </div>
        `;

        document.getElementById('manage-subscription-btn').onclick = () => {
            this.openCustomerPortal();
        };
    },

    showUpgradeOptions() {
        const container = document.getElementById('subscription-content');
        container.innerHTML = `
            <div class="grid md:grid-cols-2 gap-6">
                <!-- Free Tier -->
                <div class="border rounded-lg p-6">
                    <h3 class="text-xl font-bold mb-2">Free</h3>
                    <div class="text-3xl font-bold mb-4">$0<span class="text-sm font-normal">/month</span></div>
                    <ul class="space-y-2 mb-6">
                        <li>✓ Up to 3 events</li>
                        <li>✓ Up to 25 ropers</li>
                        <li>✓ Cloud backup</li>
                        <li>✓ Offline support</li>
                    </ul>
                    <button disabled class="w-full py-2 bg-gray-300 rounded cursor-not-allowed">
                        Current Plan
                    </button>
                </div>

                <!-- Pro Tier -->
                <div class="border-2 border-blue-600 rounded-lg p-6 relative">
                    <div class="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm rounded-bl">
                        Recommended
                    </div>
                    <h3 class="text-xl font-bold mb-2">Pro</h3>
                    <div class="text-3xl font-bold mb-4">$7<span class="text-sm font-normal">/month</span></div>
                    <ul class="space-y-2 mb-6">
                        <li>✓ Unlimited events</li>
                        <li>✓ Unlimited ropers</li>
                        <li>✓ Export to CSV/PDF</li>
                        <li>✓ Advanced statistics</li>
                        <li>✓ Priority support</li>
                    </ul>
                    <button id="subscribe-monthly-btn" class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Upgrade to Pro
                    </button>
                    <button id="subscribe-annual-btn" class="w-full mt-2 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
                        Pay Annually ($60/year - Save $24)
                    </button>
                </div>
            </div>
        `;
    },

    async openCustomerPortal() {
        // Redirect to Stripe customer portal to manage subscription
        const { data, error } = await supabase.functions.invoke('create-portal-session', {
            body: {
                userId: authManager.getCurrentUser().id
            }
        });

        if (error) {
            app.showNotification('Failed to open portal: ' + error.message, 'error');
            return;
        }

        window.location.href = data.url;
    }
};
```

### 6.4 Create Supabase Edge Functions

Stripe checkout requires server-side code. Use Supabase Edge Functions:

**Create function:** `supabase/functions/create-checkout/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  try {
    const { priceId, userId, userEmail } = await req.json()

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/#subscription-success`,
      cancel_url: `${req.headers.get('origin')}/#subscription-cancel`,
      metadata: {
        userId: userId,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
```

**Deploy function:**
```bash
supabase functions deploy create-checkout
```

### 6.5 Handle Stripe Webhooks

Create webhook handler to update user subscription status:

**Create function:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        // Update user profile with subscription
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'pro',
            subscription_id: session.subscription,
          })
          .eq('id', session.metadata.userId)
        break

      case 'customer.subscription.deleted':
        const subscription = event.data.object
        // Downgrade user to free
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'free',
            subscription_id: null,
          })
          .eq('subscription_id', subscription.id)
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### 6.6 Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://[your-project].supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy webhook signing secret
5. Add to Supabase secrets:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

---

## Phase 7: UI Updates

**Timeline:** Week 7-8 (4-6 hours)
**Dependencies:** All previous phases
**Difficulty:** Easy

### 7.1 Add Sync Status Indicator

Update footer in `index.html`:

```html
<footer class="p-4 bg-white border-t text-center text-sm text-gray-600">
    <div class="flex items-center justify-between max-w-4xl mx-auto">
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
                <div id="online-status" class="w-2 h-2 rounded-full bg-green-500"></div>
                <span id="status-text">Online</span>
            </div>
            <span class="text-gray-400">|</span>
            <div id="sync-status" class="text-gray-500">Not synced</div>
        </div>

        <div class="flex items-center gap-3">
            <span id="user-email" class="text-gray-700"></span>
            <button id="sync-now-btn" class="text-blue-600 hover:underline auth-required" style="display: none;">
                Sync Now
            </button>
            <button id="logout-btn" class="text-red-600 hover:underline auth-required" style="display: none;">
                Logout
            </button>
        </div>
    </div>
</footer>
```

### 7.2 Add User Profile Menu

Add to sidebar in `index.html`:

```html
<!-- In sidebar, after navigation links -->
<div class="mt-auto p-4 border-t border-blue-700 auth-required" style="display: none;">
    <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            <span id="user-initial">U</span>
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-white truncate" id="sidebar-user-email"></div>
            <div class="text-xs text-blue-200" id="subscription-badge">Free Plan</div>
        </div>
    </div>
    <a href="#subscription" class="block w-full py-2 text-center bg-yellow-500 text-gray-900 rounded font-medium hover:bg-yellow-400">
        Upgrade to Pro
    </a>
</div>
```

### 7.3 Add Feature Limits

Update relevant pages to check subscription status:

```javascript
// Example: In events.js, before creating event
async createEvent(eventData) {
    // Check if user is on free plan and at limit
    const profile = await this.getUserProfile();

    if (profile.subscription_status === 'free') {
        const eventCount = await db.events.count();
        if (eventCount >= 3) {
            app.showNotification('Free plan limited to 3 events. Upgrade to Pro for unlimited!', 'error');
            router.navigate('subscription');
            return;
        }
    }

    // Rest of create event logic...
}
```

---

## Phase 8: Testing Strategy

**Timeline:** Week 8-9 (8-10 hours)
**Dependencies:** All implementation complete
**Difficulty:** Medium

### 8.1 Manual Testing Checklist

**Authentication Tests:**
- [ ] Sign up new account
- [ ] Verify email confirmation
- [ ] Sign in with email/password
- [ ] Sign out
- [ ] Password reset flow
- [ ] Session persistence (reload page, still logged in)

**Sync Tests:**
- [ ] Create roper while online → Check appears in Supabase
- [ ] Create roper while offline → Go online → Check syncs
- [ ] Edit roper on device A → Check appears on device B
- [ ] Delete roper (soft delete) → Check syncs
- [ ] Create event with ropers → Check all data syncs
- [ ] Record times → Check syncs immediately

**Offline Tests:**
- [ ] Disconnect internet
- [ ] Create/edit/delete data offline
- [ ] Check data persists in IndexedDB
- [ ] Reconnect internet
- [ ] Verify all changes sync to cloud
- [ ] Check UI shows correct sync status

**Conflict Tests:**
- [ ] Edit same roper on two devices while offline
- [ ] Bring both online
- [ ] Verify last write wins (or manual resolution)
- [ ] Check no data loss

**Payment Tests:**
- [ ] Upgrade to Pro (use Stripe test mode)
- [ ] Check subscription status updates
- [ ] Verify Pro features unlock
- [ ] Cancel subscription
- [ ] Check downgrade to Free

**Multi-Device Tests:**
- [ ] Sign in on desktop
- [ ] Sign in on phone with same account
- [ ] Create data on desktop → Check appears on phone
- [ ] Edit data on phone → Check appears on desktop
- [ ] Sign out on one device → Check other stays signed in

### 8.2 Automated Testing Setup (Optional)

If you want to add automated tests later:

```javascript
// Example test with Vitest or Jest
describe('Sync Manager', () => {
    test('pushRoper creates cloud record', async () => {
        const roper = {
            id: 1,
            name: 'Test Roper',
            position: 'header',
            skillLevel: 5
        };

        await syncManager.pushRoper(roper, 'test-user-id');

        // Verify roper exists in cloud
        const { data } = await supabase
            .from('ropers')
            .select('*')
            .eq('name', 'Test Roper')
            .single();

        expect(data.name).toBe('Test Roper');
    });
});
```

---

## Phase 9: Deployment

**Timeline:** Week 9 (3-4 hours)
**Dependencies:** Testing complete
**Difficulty:** Easy

### 9.1 Prepare for Deployment

**Update Service Worker cache version:**
```javascript
// In sw.js
const CACHE_NAME = 'round-robin-roping-v20'; // Increment version
```

**Environment variables:**
Create `.env.production` file:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```

**Update config.js to use environment variables:**
```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGc...';
```

### 9.2 Deploy to Netlify

**Via Git (Recommended):**

1. Push code to GitHub:
   ```bash
   cd roundrobin
   git init
   git add .
   git commit -m "Add cloud sync and authentication"
   git branch -M main
   git remote add origin https://github.com/yourusername/roundrobin-roping.git
   git push -u origin main
   ```

2. Connect to Netlify:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select your repository
   - Build settings:
     - Build command: (leave empty - static site)
     - Publish directory: `/`
   - Add environment variables
   - Click "Deploy"

**Via Drag & Drop:**

1. Build locally (if needed)
2. Go to [netlify.com](https://netlify.com)
3. Drag `roundrobin` folder to deploy area
4. Add environment variables in Site settings
5. Redeploy if needed

### 9.3 Configure Custom Domain

1. Buy domain (e.g., roundrobinroping.com) from:
   - Namecheap
   - Google Domains
   - Cloudflare

2. In Netlify:
   - Site settings → Domain management
   - Add custom domain
   - Follow DNS configuration instructions

3. SSL automatically provisioned by Netlify

### 9.4 Update PWA Manifest

Update `manifest.json` with production URL:

```json
{
  "name": "Round Robin Roping Manager",
  "start_url": "https://roundrobinroping.com/",
  "scope": "/"
}
```

---

## Phase 10: Migration Plan

**Timeline:** Ongoing
**Dependencies:** Deployment complete
**Difficulty:** Easy

### 10.1 Existing User Migration

Users who already have local data need to migrate to cloud:

**Auto-migration on first login:**

```javascript
// In authManager.onLogin()
async onLogin(user) {
    console.log('User logged in:', user.email);

    // Check if this is first login (no cloudId on any records)
    const hasCloudData = await this.checkHasCloudData();

    if (!hasCloudData) {
        // First login - migrate existing local data
        const confirmed = confirm(
            'Migrate your existing local data to the cloud? ' +
            'This will allow you to access it on other devices.'
        );

        if (confirmed) {
            app.showNotification('Migrating your data to cloud...', 'info');
            await syncManager.performFullSync();
            app.showNotification('Migration complete!', 'success');
        }
    } else {
        // Not first login - normal sync
        await syncManager.performFullSync();
    }

    // Rest of onLogin logic...
}

async checkHasCloudData() {
    const roperWithCloudId = await db.ropers
        .where('cloudId')
        .notEqual(null)
        .first();

    return !!roperWithCloudId;
}
```

### 10.2 Rollback Plan

If something goes wrong:

**Keep local-only mode available:**

```javascript
// Add "Use Offline Mode" option throughout app
const offlineMode = localStorage.getItem('offlineMode') === 'true';

if (offlineMode) {
    // Skip all sync operations
    // Don't require authentication
}
```

**User can enable offline mode:**
```javascript
function enableOfflineMode() {
    localStorage.setItem('offlineMode', 'true');
    app.showNotification('Offline mode enabled. Data will not sync.', 'info');
    location.reload();
}
```

---

## File-by-File Changes Summary

### New Files to Create

```
roundrobin/
├── js/
│   ├── config.js          # Supabase configuration
│   ├── supabase.js        # Supabase client initialization
│   ├── auth.js            # Authentication manager
│   ├── sync.js            # Sync manager
│   └── pages/
│       ├── login.js       # Login page handler
│       ├── signup.js      # Signup page handler
│       ├── forgot-password.js  # Password reset handler
│       └── subscription.js     # Subscription/checkout page
├── supabase/
│   └── functions/
│       ├── create-checkout/
│       │   └── index.ts
│       ├── create-portal-session/
│       │   └── index.ts
│       └── stripe-webhook/
│           └── index.ts
└── .env.production        # Environment variables
```

### Files to Modify

**index.html:**
- Add Supabase library
- Add login/signup/subscription pages HTML
- Add sync status indicator
- Add user profile menu
- Add auth-required/auth-hidden classes

**js/db.js:**
- Add version 5 with sync fields
- Update all CRUD helpers to mark syncStatus
- Add sync tracking fields to schema

**js/app.js:**
- Initialize authManager
- Initialize syncManager
- Update online status to trigger sync

**js/router.js:**
- Add auth check before navigation
- Add routes for login/signup/subscription

**js/pages/*.js (all page files):**
- Check subscription status before premium actions
- Show upgrade prompts for free users

**manifest.json:**
- Update start_url with production URL

**sw.js:**
- Increment CACHE_NAME version
- Cache new auth/sync files

---

## Code Examples

### Complete Example: Creating a Roper with Sync

```javascript
// User clicks "Add Roper" button
async function handleAddRoper(event) {
    event.preventDefault();

    const roper = {
        name: document.getElementById('roper-name').value,
        position: document.getElementById('roper-position').value,
        skillLevel: parseInt(document.getElementById('roper-skill').value)
    };

    // 1. Save to IndexedDB immediately (offline-first)
    const id = await db.ropers.add({
        ...roper,
        deleted: false,
        createdAt: new Date(),
        syncStatus: 'pending',       // Mark as needing sync
        localModifiedAt: new Date(),
        cloudId: null,
        cloudModifiedAt: null
    });

    // 2. Update UI immediately (no waiting for sync)
    await ropersList.refresh();
    app.showNotification('Roper added!', 'success');

    // 3. Sync to cloud if online and authenticated
    if (navigator.onLine && authManager.isAuthenticated()) {
        try {
            // Push to Supabase
            const { data, error } = await supabase
                .from('ropers')
                .insert({
                    user_id: authManager.getCurrentUser().id,
                    name: roper.name,
                    position: roper.position,
                    skill_level: roper.skillLevel,
                    deleted: false
                })
                .select()
                .single();

            if (error) throw error;

            // Update local record with cloud ID
            await db.ropers.update(id, {
                cloudId: data.id,
                syncStatus: 'synced',
                cloudModifiedAt: data.updated_at
            });

            console.log('Roper synced to cloud');

        } catch (error) {
            console.error('Sync failed, will retry later:', error);
            // Record stays in 'pending' status
            // Background sync will retry
        }
    } else {
        console.log('Offline or not authenticated - will sync later');
        // Record stays in 'pending' status
    }
}
```

---

## Troubleshooting Guide

### Issue: Sync Not Working

**Symptoms:** Data not appearing in Supabase

**Debug steps:**
1. Check browser console for errors
2. Verify user is authenticated: `authManager.isAuthenticated()`
3. Check sync status: `await db.ropers.where('syncStatus').equals('pending').toArray()`
4. Manually trigger sync: `await syncManager.performFullSync()`
5. Check Supabase logs: Dashboard → Logs

**Common causes:**
- Row Level Security policies blocking access
- Network errors (check DevTools Network tab)
- Invalid cloud IDs for foreign keys
- User not authenticated

### Issue: Authentication Errors

**Symptoms:** Can't sign in, token errors

**Debug steps:**
1. Check Supabase project URL is correct
2. Verify anon key is correct
3. Check email confirmation settings (Supabase → Auth → Email templates)
4. Look for error messages in console

**Common causes:**
- Wrong API keys
- Email not verified (check Supabase Auth settings)
- RLS policies too restrictive
- Session expired

### Issue: Conflicts Not Resolving

**Symptoms:** Same data keeps changing back and forth

**Debug steps:**
1. Check timestamps: `localModifiedAt` vs `cloudModifiedAt`
2. Verify only one device is syncing at a time
3. Check conflict resolution logic in `syncManager.mergeRecord()`

**Common causes:**
- Clock skew between devices
- Race condition in sync logic
- Background sync interfering

### Issue: Payment Not Processing

**Symptoms:** Stripe checkout fails, subscription not activating

**Debug steps:**
1. Check Stripe dashboard → Events for errors
2. Verify webhook is receiving events
3. Check Supabase Edge Function logs
4. Test in Stripe test mode first

**Common causes:**
- Webhook secret mismatch
- Edge function not deployed
- Network timeout
- Invalid price ID

---

## Performance Optimization

### Lazy Loading Sync

Don't sync everything on page load:

```javascript
// Only sync when user interacts
async function lazySync() {
    if (!this.hasSynced) {
        await syncManager.performIncrementalSync();
        this.hasSynced = true;
    }
}
```

### Batch Sync Operations

Don't sync one record at a time:

```javascript
async function batchPushRopers(ropers) {
    const data = ropers.map(r => ({
        user_id: userId,
        name: r.name,
        position: r.position,
        skill_level: r.skillLevel
    }));

    const { data: inserted, error } = await supabase
        .from('ropers')
        .insert(data)
        .select();

    // Update all local records with cloud IDs
    for (let i = 0; i < ropers.length; i++) {
        await db.ropers.update(ropers[i].id, {
            cloudId: inserted[i].id,
            syncStatus: 'synced'
        });
    }
}
```

### Index Optimization

Add database indexes for common queries:

```sql
-- In Supabase SQL Editor
CREATE INDEX idx_ropers_sync_status ON ropers(user_id, sync_status);
CREATE INDEX idx_events_user_date ON events(user_id, date DESC);
CREATE INDEX idx_runs_event_completed ON runs(event_id, completed);
```

---

## Security Checklist

- [ ] Never expose service role key in client code
- [ ] Always use RLS policies on all tables
- [ ] Validate user owns data before operations
- [ ] Sanitize user input
- [ ] Use HTTPS only (automatically handled by Netlify)
- [ ] Implement rate limiting (Supabase has built-in)
- [ ] Hash sensitive data (passwords handled by Supabase Auth)
- [ ] Validate Stripe webhooks (signature verification)
- [ ] Set up CORS properly (Supabase handles this)
- [ ] Monitor for suspicious activity (Supabase logs)

---

## Cost Monitoring

### Set Up Alerts

**Supabase:**
- Dashboard → Settings → Billing
- Set up email alerts at 50%, 80%, 100% of quota

**Stripe:**
- Dashboard → Settings → Notifications
- Enable all important notifications

**Netlify:**
- Site settings → Usage and billing
- Set usage alerts

### Typical Monthly Costs (100 paying users)

| Service | Cost |
|---------|------|
| Supabase | $25 (if >500MB DB) |
| Netlify | $0 (free tier sufficient) |
| Domain | $1 (amortized) |
| Stripe | ~$21 (2.9% of $700) |
| **Total** | **~$47** |

**Profit:** $700 revenue - $47 costs = **$653/month (93% margin)**

---

## Next Steps After Launch

### Week 1-2 After Launch
- [ ] Monitor error logs daily
- [ ] Respond to user feedback within 24 hours
- [ ] Fix critical bugs immediately
- [ ] Track key metrics (signups, activations, churn)

### Month 1-3
- [ ] Add most-requested features
- [ ] Improve onboarding flow
- [ ] Create video tutorials
- [ ] SEO optimization

### Month 3-6
- [ ] Add Organization tier
- [ ] Build marketing automation
- [ ] Create affiliate program
- [ ] Expand feature set

### Month 6-12
- [ ] Consider mobile apps (React Native)
- [ ] Add premium features
- [ ] Partnership outreach
- [ ] Scale marketing

---

## Conclusion

This implementation plan transforms your local-only PWA into a full-featured SaaS product while preserving its core strength: offline-first functionality.

**Key Success Factors:**
1. Start small - implement phases in order
2. Test thoroughly after each phase
3. Get real users early for feedback
4. Don't over-engineer - ship and iterate
5. Focus on user value, not tech complexity

**Timeline Summary:**
- **Weeks 1-2:** Supabase setup + schema (8-10 hours)
- **Weeks 3-4:** Authentication (8-10 hours)
- **Weeks 5-6:** Sync layer (12-15 hours)
- **Week 7:** Payments (6-8 hours)
- **Week 8:** UI updates (4-6 hours)
- **Week 9:** Testing + deployment (10-12 hours)

**Total: 50-60 hours** of work to go from local-only to full SaaS.

**You're ready to build. Good luck!** 🚀

---

*Document created: October 15, 2025*
*Questions? Review the monetization analysis in `MONETIZATION_ANALYSIS.md`*
