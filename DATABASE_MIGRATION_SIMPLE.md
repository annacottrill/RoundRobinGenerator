# Simple Database Migration (No Auth)

## Overview

This is a simplified version of the database migration that:
- Replaces IndexedDB with Supabase PostgreSQL
- No authentication/login required
- Single shared database (all users see same data)
- Good for testing database functionality before adding auth

**Use Case:** Team events where everyone managing the same shared data, or just getting the database working before adding multi-user support.

---

## Step 1: Create Supabase Account & Project

### 1.1 Sign Up
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub or email
3. Confirm your email

### 1.2 Create Project
1. Click "New Project"
2. Fill in details:
   - **Name:** `roundrobin-roping`
   - **Database Password:** Generate strong password (SAVE THIS!)
   - **Region:** Choose closest to you (e.g., US West)
   - **Pricing Plan:** Free tier is fine
3. Click "Create new project"
4. Wait 2-3 minutes for provisioning

### 1.3 Get Project Credentials
1. Go to **Settings** → **API**
2. Copy and save:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...` (long token)

---

## Step 2: Create Database Schema

### 2.1 Open SQL Editor
1. In Supabase dashboard, click **SQL Editor**
2. Click **New Query**

### 2.2 Create Tables

Copy and paste this entire SQL script:

```sql
-- ============================================
-- ROPERS TABLE
-- ============================================
CREATE TABLE public.ropers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('header', 'heeler', 'both')),
  skill_level INTEGER NOT NULL CHECK (skill_level >= 1 AND skill_level <= 10),
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX ropers_deleted_idx ON public.ropers(deleted);
CREATE INDEX ropers_name_idx ON public.ropers(name);

-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE public.events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  roper_ids BIGINT[] NOT NULL DEFAULT '{}',
  pairings JSONB NOT NULL DEFAULT '[]',
  penalties JSONB NOT NULL DEFAULT '[
    {"name": "One Leg", "seconds": 5},
    {"name": "Barrier", "seconds": 5}
  ]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX events_date_idx ON public.events(date DESC);
CREATE INDEX events_status_idx ON public.events(status);

-- ============================================
-- RUNS TABLE
-- ============================================
CREATE TABLE public.runs (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  header_id BIGINT REFERENCES public.ropers(id) NOT NULL,
  heeler_id BIGINT REFERENCES public.ropers(id) NOT NULL,
  time NUMERIC(10, 3),
  raw_time NUMERIC(10, 3),
  penalties BOOLEAN[] DEFAULT '{}',
  round INTEGER NOT NULL DEFAULT 1,
  completed BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX runs_event_id_idx ON public.runs(event_id);
CREATE INDEX runs_completed_idx ON public.runs(completed);

-- ============================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to auto-update updated_at
CREATE TRIGGER ropers_updated_at
  BEFORE UPDATE ON public.ropers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER runs_updated_at
  BEFORE UPDATE ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- DISABLE ROW LEVEL SECURITY (No Auth)
-- ============================================
-- Since we're not using auth, disable RLS to allow all access
ALTER TABLE public.ropers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs DISABLE ROW LEVEL SECURITY;
```

### 2.3 Run the Script
1. Click **Run** button
2. Check for "Success" message
3. Verify tables created:
   - Click **Table Editor** in left sidebar
   - You should see: `ropers`, `events`, `runs`

---

## Step 3: Install Supabase Client

### 3.1 Add Supabase Library

Open [index.html](index.html) and add this script tag **before** your other script tags (around line 1460):

```html
<!-- Supabase JS Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Scripts -->
<script src="js/db.js"></script>
```

### 3.2 Create Supabase Config File

Create a new file: `roundrobin/js/supabase-config.js`

```javascript
/**
 * Supabase Configuration
 * Replace with your actual Supabase credentials
 */

const SUPABASE_URL = 'https://xxxxx.supabase.co'; // REPLACE THIS
const SUPABASE_ANON_KEY = 'eyJhbGc...'; // REPLACE THIS

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export globally
window.supabaseClient = supabaseClient;

console.log('Supabase initialized');
```

**IMPORTANT:** Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your actual values from Step 1.3!

### 3.3 Add Config to index.html

Add this line to [index.html](index.html) after the Supabase library:

```html
<!-- Supabase JS Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
```

---

## Step 4: Update Database Helper (db.js)

We'll modify the existing `db.js` to use Supabase instead of IndexedDB.

### 4.1 Backup Current db.js

```bash
cp roundrobin/js/db.js roundrobin/js/db.js.backup
```

### 4.2 Replace dbHelpers Object

Find the `dbHelpers` object in [js/db.js](js/db.js) and replace it with this Supabase version:

```javascript
/**
 * Database Helpers - Supabase Version
 */
const dbHelpers = {
    /**
     * Get all ropers (non-deleted by default)
     */
    async getAllRopers(includeDeleted = false) {
        try {
            let query = supabaseClient
                .from('ropers')
                .select('*')
                .order('name');

            if (!includeDeleted) {
                query = query.eq('deleted', false);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map to match IndexedDB format (snake_case to camelCase)
            return data.map(r => ({
                id: r.id,
                name: r.name,
                position: r.position,
                skillLevel: r.skill_level,
                deleted: r.deleted,
                createdAt: r.created_at
            }));
        } catch (error) {
            console.error('Error getting ropers:', error);
            return [];
        }
    },

    /**
     * Get all ropers including deleted ones
     */
    async getAllRopersIncludingDeleted() {
        return this.getAllRopers(true);
    },

    /**
     * Get single roper by ID
     */
    async getRoper(id) {
        try {
            const { data, error } = await supabaseClient
                .from('ropers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                name: data.name,
                position: data.position,
                skillLevel: data.skill_level,
                deleted: data.deleted,
                createdAt: data.created_at
            };
        } catch (error) {
            console.error('Error getting roper:', error);
            return null;
        }
    },

    /**
     * Add new roper
     */
    async addRoper(roper) {
        try {
            const { data, error } = await supabaseClient
                .from('ropers')
                .insert({
                    name: roper.name,
                    position: roper.position,
                    skill_level: roper.skillLevel,
                    deleted: false
                })
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error adding roper:', error);
            throw error;
        }
    },

    /**
     * Update roper
     */
    async updateRoper(id, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.position !== undefined) updateData.position = updates.position;
            if (updates.skillLevel !== undefined) updateData.skill_level = updates.skillLevel;
            if (updates.deleted !== undefined) updateData.deleted = updates.deleted;

            const { error } = await supabaseClient
                .from('ropers')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating roper:', error);
            throw error;
        }
    },

    /**
     * Delete roper (soft delete)
     */
    async deleteRoper(id) {
        return this.updateRoper(id, { deleted: true });
    },

    /**
     * Get all events
     */
    async getAllEvents() {
        try {
            const { data, error } = await supabaseClient
                .from('events')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            return data.map(e => ({
                id: e.id,
                name: e.name,
                date: e.date,
                roperIds: e.roper_ids,
                pairings: e.pairings,
                penalties: e.penalties,
                status: e.status,
                createdAt: e.created_at
            }));
        } catch (error) {
            console.error('Error getting events:', error);
            return [];
        }
    },

    /**
     * Get single event by ID
     */
    async getEvent(id) {
        try {
            const { data, error } = await supabaseClient
                .from('events')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                name: data.name,
                date: data.date,
                roperIds: data.roper_ids,
                pairings: data.pairings,
                penalties: data.penalties,
                status: data.status,
                createdAt: data.created_at
            };
        } catch (error) {
            console.error('Error getting event:', error);
            return null;
        }
    },

    /**
     * Add new event
     */
    async addEvent(event) {
        try {
            const { data, error } = await supabaseClient
                .from('events')
                .insert({
                    name: event.name,
                    date: event.date,
                    roper_ids: event.roperIds || [],
                    pairings: event.pairings || [],
                    penalties: event.penalties || [
                        { name: 'One Leg', seconds: 5 },
                        { name: 'Barrier', seconds: 5 }
                    ],
                    status: event.status || 'active'
                })
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error adding event:', error);
            throw error;
        }
    },

    /**
     * Update event
     */
    async updateEvent(id, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.date !== undefined) updateData.date = updates.date;
            if (updates.roperIds !== undefined) updateData.roper_ids = updates.roperIds;
            if (updates.pairings !== undefined) updateData.pairings = updates.pairings;
            if (updates.penalties !== undefined) updateData.penalties = updates.penalties;
            if (updates.status !== undefined) updateData.status = updates.status;

            const { error } = await supabaseClient
                .from('events')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    },

    /**
     * Delete event
     */
    async deleteEvent(id) {
        try {
            const { error } = await supabaseClient
                .from('events')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    },

    /**
     * Get all runs for an event
     */
    async getRunsForEvent(eventId) {
        try {
            const { data, error } = await supabaseClient
                .from('runs')
                .select('*')
                .eq('event_id', eventId)
                .order('round');

            if (error) throw error;

            return data.map(r => ({
                id: r.id,
                eventId: r.event_id,
                headerId: r.header_id,
                heelerId: r.heeler_id,
                time: r.time,
                rawTime: r.raw_time,
                penalties: r.penalties,
                round: r.round,
                completed: r.completed,
                recordedAt: r.recorded_at
            }));
        } catch (error) {
            console.error('Error getting runs:', error);
            return [];
        }
    },

    /**
     * Add new run
     */
    async addRun(run) {
        try {
            const { data, error } = await supabaseClient
                .from('runs')
                .insert({
                    event_id: run.eventId,
                    header_id: run.headerId,
                    heeler_id: run.heelerId,
                    time: run.time,
                    raw_time: run.rawTime,
                    penalties: run.penalties || [],
                    round: run.round || 1,
                    completed: run.completed || false,
                    recorded_at: run.recordedAt
                })
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error adding run:', error);
            throw error;
        }
    },

    /**
     * Update run
     */
    async updateRun(id, updates) {
        try {
            const updateData = {};
            if (updates.time !== undefined) updateData.time = updates.time;
            if (updates.rawTime !== undefined) updateData.raw_time = updates.rawTime;
            if (updates.penalties !== undefined) updateData.penalties = updates.penalties;
            if (updates.completed !== undefined) updateData.completed = updates.completed;
            if (updates.recordedAt !== undefined) updateData.recorded_at = updates.recordedAt;

            const { error } = await supabaseClient
                .from('runs')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating run:', error);
            throw error;
        }
    },

    /**
     * Delete run
     */
    async deleteRun(id) {
        try {
            const { error } = await supabaseClient
                .from('runs')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting run:', error);
            throw error;
        }
    },

    /**
     * Clear all data (for testing)
     */
    async clearAllData() {
        if (!confirm('Clear ALL data from database? This cannot be undone!')) {
            return;
        }

        try {
            await supabaseClient.from('runs').delete().neq('id', 0);
            await supabaseClient.from('events').delete().neq('id', 0);
            await supabaseClient.from('ropers').delete().neq('id', 0);
            console.log('All data cleared');
        } catch (error) {
            console.error('Error clearing data:', error);
        }
    }
};

// Remove old Dexie database initialization
// (Keep the export)
window.dbHelpers = dbHelpers;
console.log('Database helpers loaded (Supabase version)');
```

---

## Step 5: Remove IndexedDB Code

### 5.1 Comment Out Dexie Initialization

In [js/db.js](js/db.js), find and comment out the Dexie initialization:

```javascript
// OLD: Comment out or delete this entire section
/*
const db = new Dexie('RoundRobinRoping');

db.version(4).stores({
    ropers: '++id, name, position, skillLevel, deleted',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round, completed'
});
*/

// Keep the dbHelpers object (now using Supabase)
```

### 5.2 Remove Dexie Script from index.html

In [index.html](index.html), remove or comment out the Dexie library:

```html
<!-- OLD: Remove or comment out -->
<!-- <script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script> -->
```

---

## Step 6: Test the Migration

### 6.1 Open the App

```bash
cd /Users/annacottrill/git/personal/roundrobin
open index.html
```

Or use http-server:
```bash
http-server -p 8000
```

### 6.2 Test Basic Operations

1. **Add a Roper:**
   - Go to Manage Ropers
   - Add "Test Header 1" as Header, skill 5
   - Check Supabase Table Editor - should see the roper appear!

2. **Edit a Roper:**
   - Edit the roper you just created
   - Change name or skill level
   - Verify update in Supabase

3. **Create an Event:**
   - Go to Manage Events
   - Create new event
   - Select ropers
   - Check Supabase Table Editor - event should appear!

4. **Record Times:**
   - Go to Record Times
   - Select your event
   - Record a time
   - Check Supabase runs table!

### 6.3 Check Data in Supabase

1. Go to Supabase Dashboard → **Table Editor**
2. Click on each table (ropers, events, runs)
3. You should see your data!

---

## Common Issues & Solutions

### Issue: "Failed to fetch" or CORS errors

**Solution:** Make sure you're using the correct Supabase URL and key. The anon key is safe to use in browser code.

### Issue: "Cannot read property 'from' of undefined"

**Solution:** Supabase client not initialized. Check:
1. Supabase library loaded before supabase-config.js
2. supabase-config.js loaded before db.js
3. Correct script order in index.html

### Issue: Data not appearing in Supabase

**Solution:**
1. Check browser console for errors
2. Verify RLS is disabled: `ALTER TABLE public.ropers DISABLE ROW LEVEL SECURITY;`
3. Check network tab to see if requests are going through

### Issue: "relation does not exist"

**Solution:** Tables not created. Go back to Step 2 and run the SQL script again.

---

## Rollback Plan

If something goes wrong and you want to go back to IndexedDB:

1. Restore backup:
   ```bash
   cp roundrobin/js/db.js.backup roundrobin/js/db.js
   ```

2. In index.html, restore Dexie and remove Supabase:
   ```html
   <script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>
   <!-- Remove Supabase scripts -->
   ```

3. Reload the app - it will use IndexedDB again

---

## Next Steps

Once this is working:

1. ✅ You have a real PostgreSQL database
2. ✅ All CRUD operations work
3. ✅ Data persists in the cloud
4. ✅ Multiple people can access same database

### Future Enhancements:

- **Add Authentication** - Use full implementation plan to add user accounts
- **Add Offline Support** - Keep IndexedDB as cache with Supabase sync
- **Add Real-time** - Supabase has built-in real-time subscriptions
- **Add Backups** - Supabase auto-backs up your data

---

## Cost

**Free tier limits:**
- 500MB database
- 2GB bandwidth/month
- 50,000 monthly active users

**For small team roping events, this is more than enough and will stay FREE!**

---

Ready to start? Let me know if you have questions!
