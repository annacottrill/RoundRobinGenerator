# Offline-First Database Migration (Local + Cloud Sync)

## Overview

This approach maintains IndexedDB as the **primary database** and adds **optional cloud sync** to Supabase:

- ✅ **Offline-first:** App works completely offline, all data in IndexedDB
- ✅ **Manual sync:** User clicks "Sync to Cloud" button when ready
- ✅ **Auto-sync option:** Optionally sync when internet is available
- ✅ **No authentication:** Single shared cloud database (can add auth later)
- ✅ **Fallback safe:** If cloud fails, app continues working with local data

**Perfect for:** Roping events in remote locations with spotty internet, want local data always available but cloud backup when convenient.

---

## Architecture

```
┌─────────────────┐
│   Browser UI    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│   IndexedDB     │◄────►│  Sync Layer  │
│   (Primary)     │      └──────┬───────┘
└─────────────────┘             │
                                │ (Optional)
                      ┌─────────▼──────────┐
                      │   Supabase Cloud   │
                      │   (Backup/Share)   │
                      └────────────────────┘
```

**Key Points:**
- UI always reads/writes to IndexedDB
- Cloud sync happens in background
- User controls when to sync
- If offline, sync queues for later

---

## Step 1: Create Supabase Project

Same as simple version - follow DATABASE_MIGRATION_SIMPLE.md Step 1:

1. Create account at [supabase.com](https://supabase.com)
2. Create new project: `roundrobin-roping`
3. Save credentials:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon key: `eyJhbGc...`

---

## Step 2: Create Database Schema

Same SQL as simple version. In Supabase Dashboard → SQL Editor, run:

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
ALTER TABLE public.ropers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs DISABLE ROW LEVEL SECURITY;
```

---

## Step 3: Update IndexedDB Schema (Add Sync Tracking)

We need to track which records have been synced to cloud.

### 3.1 Update db.js Schema

In [js/db.js](js/db.js), update the Dexie version to add sync tracking fields:

```javascript
const db = new Dexie('RoundRobinRoping');

// Update to version 5 to add sync fields
db.version(5).stores({
    ropers: '++id, name, position, skillLevel, deleted, cloudId, syncStatus',
    events: '++id, name, date, createdAt, cloudId, syncStatus',
    runs: '++id, eventId, headerId, heelerId, time, round, completed, cloudId, syncStatus'
}).upgrade(tx => {
    // Migration: Add sync fields to existing records
    return Promise.all([
        tx.table('ropers').toCollection().modify(roper => {
            if (roper.cloudId === undefined) roper.cloudId = null;
            if (roper.syncStatus === undefined) roper.syncStatus = 'pending';
            if (roper.localModifiedAt === undefined) roper.localModifiedAt = roper.createdAt || new Date();
        }),
        tx.table('events').toCollection().modify(event => {
            if (event.cloudId === undefined) event.cloudId = null;
            if (event.syncStatus === undefined) event.syncStatus = 'pending';
            if (event.localModifiedAt === undefined) event.localModifiedAt = event.createdAt || new Date();
        }),
        tx.table('runs').toCollection().modify(run => {
            if (run.cloudId === undefined) run.cloudId = null;
            if (run.syncStatus === undefined) run.syncStatus = 'pending';
            if (run.localModifiedAt === undefined) run.localModifiedAt = new Date();
        })
    ]);
});
```

**New fields explained:**
- `cloudId`: The ID of this record in Supabase (null if never synced)
- `syncStatus`: 'pending', 'synced', or 'error'
- `localModifiedAt`: Timestamp of last local change

### 3.2 Keep Existing dbHelpers

**DO NOT change the existing dbHelpers functions!** They should continue working with IndexedDB as-is.

---

## Step 4: Add Supabase Client

### 4.1 Add Supabase Library to HTML

In [index.html](index.html), add Supabase script **before** your other scripts:

```html
<!-- Supabase JS Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Existing scripts -->
<script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>
<script src="js/db.js"></script>
```

### 4.2 Create Supabase Config

Create new file: `roundrobin/js/supabase-config.js`

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

### 4.3 Add to HTML

In [index.html](index.html):

```html
<!-- Supabase JS Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>

<!-- Existing scripts -->
<script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>
<script src="js/db.js"></script>
```

---

## Step 5: Create Sync Manager

Create new file: `roundrobin/js/sync-manager.js`

```javascript
/**
 * Sync Manager - Offline First
 *
 * Syncs local IndexedDB data to Supabase cloud when user wants
 */

const syncManager = {
    isSyncing: false,
    lastSyncTime: null,
    autoSyncEnabled: false,

    /**
     * Initialize sync manager
     */
    init() {
        // Load settings from localStorage
        this.lastSyncTime = localStorage.getItem('lastSyncTime');
        this.autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';

        // Auto-sync if enabled and online
        if (this.autoSyncEnabled && navigator.onLine) {
            this.performSync();
        }

        // Listen for online event
        window.addEventListener('online', () => {
            if (this.autoSyncEnabled) {
                console.log('Back online - syncing...');
                this.performSync();
            }
        });

        console.log('Sync manager initialized');
        this.updateSyncUI();
    },

    /**
     * Perform full sync (push and pull)
     */
    async performSync() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { success: false, message: 'Sync already in progress' };
        }

        if (!navigator.onLine) {
            return { success: false, message: 'No internet connection' };
        }

        console.log('Starting sync...');
        this.isSyncing = true;
        this.updateSyncUI();

        try {
            // Step 1: Push local changes to cloud
            await this.pushToCloud();

            // Step 2: Pull cloud changes to local
            await this.pullFromCloud();

            // Update last sync time
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);

            console.log('Sync complete!');
            this.updateSyncUI();

            return { success: true, message: 'Sync complete!' };

        } catch (error) {
            console.error('Sync failed:', error);
            return { success: false, message: 'Sync failed: ' + error.message };

        } finally {
            this.isSyncing = false;
            this.updateSyncUI();
        }
    },

    /**
     * Push local data to cloud
     */
    async pushToCloud() {
        console.log('Pushing local changes to cloud...');

        // Push ropers
        await this.pushRopers();

        // Push events (must be after ropers since events reference ropers)
        await this.pushEvents();

        // Push runs (must be after events since runs reference events)
        await this.pushRuns();
    },

    /**
     * Push ropers to cloud
     */
    async pushRopers() {
        // Get all ropers that need syncing
        const ropersToSync = await db.ropers
            .where('syncStatus')
            .equals('pending')
            .toArray();

        console.log(`Pushing ${ropersToSync.length} ropers...`);

        for (const roper of ropersToSync) {
            try {
                if (roper.cloudId) {
                    // Update existing cloud record
                    const { error } = await supabaseClient
                        .from('ropers')
                        .update({
                            name: roper.name,
                            position: roper.position,
                            skill_level: roper.skillLevel,
                            deleted: roper.deleted
                        })
                        .eq('id', roper.cloudId);

                    if (error) throw error;

                } else {
                    // Create new cloud record
                    const { data, error } = await supabaseClient
                        .from('ropers')
                        .insert({
                            name: roper.name,
                            position: roper.position,
                            skill_level: roper.skillLevel,
                            deleted: roper.deleted
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    // Save cloud ID to local record
                    await db.ropers.update(roper.id, {
                        cloudId: data.id
                    });
                }

                // Mark as synced
                await db.ropers.update(roper.id, {
                    syncStatus: 'synced'
                });

                console.log(`Synced roper: ${roper.name}`);

            } catch (error) {
                console.error(`Failed to sync roper ${roper.name}:`, error);
                await db.ropers.update(roper.id, {
                    syncStatus: 'error'
                });
            }
        }
    },

    /**
     * Push events to cloud
     */
    async pushEvents() {
        const eventsToSync = await db.events
            .where('syncStatus')
            .equals('pending')
            .toArray();

        console.log(`Pushing ${eventsToSync.length} events...`);

        for (const event of eventsToSync) {
            try {
                // Map local roper IDs to cloud IDs
                const cloudRoperIds = [];
                for (const localId of event.roperIds || []) {
                    const roper = await db.ropers.get(localId);
                    if (roper && roper.cloudId) {
                        cloudRoperIds.push(roper.cloudId);
                    }
                }

                if (event.cloudId) {
                    // Update existing cloud record
                    const { error } = await supabaseClient
                        .from('events')
                        .update({
                            name: event.name,
                            date: event.date,
                            roper_ids: cloudRoperIds,
                            pairings: event.pairings,
                            penalties: event.penalties,
                            status: event.status
                        })
                        .eq('id', event.cloudId);

                    if (error) throw error;

                } else {
                    // Create new cloud record
                    const { data, error } = await supabaseClient
                        .from('events')
                        .insert({
                            name: event.name,
                            date: event.date,
                            roper_ids: cloudRoperIds,
                            pairings: event.pairings,
                            penalties: event.penalties,
                            status: event.status
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    // Save cloud ID
                    await db.events.update(event.id, {
                        cloudId: data.id
                    });
                }

                // Mark as synced
                await db.events.update(event.id, {
                    syncStatus: 'synced'
                });

                console.log(`Synced event: ${event.name}`);

            } catch (error) {
                console.error(`Failed to sync event ${event.name}:`, error);
                await db.events.update(event.id, {
                    syncStatus: 'error'
                });
            }
        }
    },

    /**
     * Push runs to cloud
     */
    async pushRuns() {
        const runsToSync = await db.runs
            .where('syncStatus')
            .equals('pending')
            .toArray();

        console.log(`Pushing ${runsToSync.length} runs...`);

        for (const run of runsToSync) {
            try {
                // Get cloud IDs for related records
                const event = await db.events.get(run.eventId);
                const header = await db.ropers.get(run.headerId);
                const heeler = await db.ropers.get(run.heelerId);

                if (!event?.cloudId || !header?.cloudId || !heeler?.cloudId) {
                    console.warn('Cannot sync run - related records not synced yet');
                    continue;
                }

                if (run.cloudId) {
                    // Update existing cloud record
                    const { error } = await supabaseClient
                        .from('runs')
                        .update({
                            time: run.time,
                            raw_time: run.rawTime,
                            penalties: run.penalties,
                            completed: run.completed,
                            recorded_at: run.recordedAt
                        })
                        .eq('id', run.cloudId);

                    if (error) throw error;

                } else {
                    // Create new cloud record
                    const { data, error } = await supabaseClient
                        .from('runs')
                        .insert({
                            event_id: event.cloudId,
                            header_id: header.cloudId,
                            heeler_id: heeler.cloudId,
                            time: run.time,
                            raw_time: run.rawTime,
                            penalties: run.penalties,
                            round: run.round,
                            completed: run.completed,
                            recorded_at: run.recordedAt
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    // Save cloud ID
                    await db.runs.update(run.id, {
                        cloudId: data.id
                    });
                }

                // Mark as synced
                await db.runs.update(run.id, {
                    syncStatus: 'synced'
                });

                console.log(`Synced run ${run.id}`);

            } catch (error) {
                console.error(`Failed to sync run ${run.id}:`, error);
                await db.runs.update(run.id, {
                    syncStatus: 'error'
                });
            }
        }
    },

    /**
     * Pull data from cloud to local
     */
    async pullFromCloud() {
        console.log('Pulling cloud changes to local...');

        // For now, we'll skip pulling to avoid conflicts
        // This can be added later with conflict resolution
        console.log('Pull from cloud not implemented yet');
    },

    /**
     * Toggle auto-sync
     */
    toggleAutoSync() {
        this.autoSyncEnabled = !this.autoSyncEnabled;
        localStorage.setItem('autoSyncEnabled', this.autoSyncEnabled.toString());
        this.updateSyncUI();

        if (this.autoSyncEnabled && navigator.onLine) {
            this.performSync();
        }
    },

    /**
     * Update sync UI elements
     */
    updateSyncUI() {
        // Update sync button
        const syncBtn = document.getElementById('sync-now-btn');
        if (syncBtn) {
            syncBtn.disabled = this.isSyncing;
            syncBtn.textContent = this.isSyncing ? 'Syncing...' : 'Sync to Cloud';
        }

        // Update auto-sync toggle
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = this.autoSyncEnabled;
        }

        // Update last sync time
        const lastSyncEl = document.getElementById('last-sync-time');
        if (lastSyncEl && this.lastSyncTime) {
            const date = new Date(this.lastSyncTime);
            lastSyncEl.textContent = `Last synced: ${date.toLocaleString()}`;
        }

        // Update online status
        const onlineStatusEl = document.getElementById('online-status');
        if (onlineStatusEl) {
            onlineStatusEl.textContent = navigator.onLine ? 'Online' : 'Offline';
            onlineStatusEl.className = navigator.onLine ? 'text-green-600' : 'text-red-600';
        }
    },

    /**
     * Get sync statistics
     */
    async getSyncStats() {
        const pendingRopers = await db.ropers.where('syncStatus').equals('pending').count();
        const pendingEvents = await db.events.where('syncStatus').equals('pending').count();
        const pendingRuns = await db.runs.where('syncStatus').equals('pending').count();

        const errorRopers = await db.ropers.where('syncStatus').equals('error').count();
        const errorEvents = await db.events.where('syncStatus').equals('error').count();
        const errorRuns = await db.runs.where('syncStatus').equals('error').count();

        return {
            pending: {
                ropers: pendingRopers,
                events: pendingEvents,
                runs: pendingRuns,
                total: pendingRopers + pendingEvents + pendingRuns
            },
            errors: {
                ropers: errorRopers,
                events: errorEvents,
                runs: errorRuns,
                total: errorRopers + errorEvents + errorRuns
            }
        };
    }
};

// Export globally
window.syncManager = syncManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    syncManager.init();
});
```

### 5.1 Add sync-manager.js to HTML

In [index.html](index.html):

```html
<script src="js/db.js"></script>
<script src="js/sync-manager.js"></script>
<script src="js/app.js"></script>
```

---

## Step 6: Update dbHelpers to Mark Changes

We need to mark records as "pending sync" when they're created or modified.

### 6.1 Update dbHelpers Functions

In [js/db.js](js/db.js), modify each CRUD function to set syncStatus:

```javascript
// Example: addRoper function
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
        cloudId: null
    });
    return id;
},

// Example: updateRoper function
async updateRoper(id, updates) {
    await db.ropers.update(id, {
        ...updates,

        // NEW: Mark as needing sync
        syncStatus: 'pending',
        localModifiedAt: new Date()
    });
},

// Apply same pattern to:
// - addEvent, updateEvent, deleteEvent
// - addRun, updateRun, deleteRun
```

---

## Step 7: Add Sync UI to Settings Page

### 7.1 Update Settings Page HTML

In [index.html](index.html), find the settings page and add sync controls:

```html
<!-- In settings page, add this section -->
<div class="max-w-2xl mx-auto p-4">
    <h2 class="text-2xl font-bold mb-6">Settings</h2>

    <!-- Cloud Sync Section -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
            </svg>
            Cloud Sync
        </h3>

        <div class="space-y-4">
            <!-- Online Status -->
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Connection Status:</span>
                <span id="online-status" class="text-sm font-medium text-green-600">Online</span>
            </div>

            <!-- Last Sync Time -->
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600" id="last-sync-time">Never synced</span>
            </div>

            <!-- Auto Sync Toggle -->
            <div class="flex items-center justify-between">
                <div>
                    <label class="text-sm font-medium">Auto-sync when online</label>
                    <p class="text-xs text-gray-500">Automatically backup to cloud when connected</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="auto-sync-toggle" class="sr-only peer" onchange="syncManager.toggleAutoSync()">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <!-- Sync Now Button -->
            <button id="sync-now-btn" onclick="handleSyncNow()"
                    class="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Sync to Cloud
            </button>

            <!-- Sync Stats -->
            <div id="sync-stats" class="text-xs text-gray-500 text-center">
                <!-- Will be populated by JS -->
            </div>
        </div>
    </div>

    <!-- Existing settings... -->
</div>
```

### 7.2 Add Sync Handler Function

In [js/pages/settings.js](js/pages/settings.js) (or create it):

```javascript
/**
 * Handle sync now button click
 */
async function handleSyncNow() {
    const result = await syncManager.performSync();

    if (result.success) {
        app.showNotification(result.message, 'success');
    } else {
        app.showNotification(result.message, 'error');
    }

    // Update stats
    await updateSyncStats();
}

/**
 * Update sync statistics display
 */
async function updateSyncStats() {
    const stats = await syncManager.getSyncStats();
    const statsEl = document.getElementById('sync-stats');

    if (statsEl) {
        if (stats.pending.total > 0) {
            statsEl.textContent = `${stats.pending.total} item(s) pending sync`;
            statsEl.className = 'text-xs text-orange-600 text-center';
        } else if (stats.errors.total > 0) {
            statsEl.textContent = `${stats.errors.total} sync error(s)`;
            statsEl.className = 'text-xs text-red-600 text-center';
        } else {
            statsEl.textContent = 'All data synced';
            statsEl.className = 'text-xs text-green-600 text-center';
        }
    }
}

// Export globally
window.handleSyncNow = handleSyncNow;
window.updateSyncStats = updateSyncStats;
```

---

## Step 8: Test the System

### 8.1 Test Offline Operation

1. Open the app
2. **Disconnect internet** (turn off WiFi)
3. Add a roper, create an event, record times
4. Everything should work normally!
5. Check IndexedDB in DevTools → Application → IndexedDB
   - All data should be there with `syncStatus: 'pending'`

### 8.2 Test Manual Sync

1. Reconnect internet
2. Go to Settings
3. Click "Sync to Cloud" button
4. Should see "Sync complete!" notification
5. Check Supabase Table Editor - your data should be there!

### 8.3 Test Auto-Sync

1. Go to Settings
2. Toggle "Auto-sync when online" ON
3. Add a new roper
4. Wait a few seconds
5. Check Supabase - should sync automatically!

---

## How It Works

### When You Create Data:

1. Data saved to IndexedDB immediately
2. UI updates instantly (no waiting for cloud)
3. Record marked with `syncStatus: 'pending'`
4. If auto-sync enabled + online → syncs in background
5. If offline → queued for later

### When You Sync:

1. Finds all records with `syncStatus: 'pending'`
2. Pushes them to Supabase
3. Saves cloud IDs to local records
4. Marks as `syncStatus: 'synced'`
5. If sync fails → marks as `syncStatus: 'error'`

### Advantages:

- ✅ **Always works offline**
- ✅ **No waiting for slow connections**
- ✅ **User controls when to sync**
- ✅ **Cloud is backup, not primary**
- ✅ **Can see sync status**

---

## Common Issues

### Issue: Records won't sync

**Check:**
1. Internet connection (see status in settings)
2. Supabase credentials correct in supabase-config.js
3. Check browser console for errors
4. Check sync stats - might show error count

### Issue: Duplicate records in cloud

**Solution:** This happens if you sync same data twice. Cloud IDs prevent this. If it happens, clear cloud data:

```sql
-- In Supabase SQL Editor
DELETE FROM runs;
DELETE FROM events;
DELETE FROM ropers;
```

Then sync again.

### Issue: Can't see cloud data in app

**Expected!** Right now we only PUSH to cloud, not pull. This is intentional - local data is primary. To add pulling/merging, see next steps.

---

## Next Steps

Once this works:

### Phase 2: Add Pull from Cloud
- Download cloud data to local on demand
- Merge cloud changes with local data
- Conflict resolution (last write wins)

### Phase 3: Add Authentication
- User accounts and login
- Each user sees only their data
- Row Level Security in Supabase

### Phase 4: Add Real-time Sync
- Live updates when other devices change data
- Supabase real-time subscriptions
- Collaborative editing

---

## Cost

**Free tier is enough:**
- 500MB database (plenty for thousands of events)
- 2GB bandwidth/month
- No credit card required

---

Ready to implement? Let me know when you want to start!
