/**
 * Database Configuration using Dexie.js (IndexedDB wrapper)
 *
 * This file defines the database schema for the Round Robin Roping app.
 * Three main tables: ropers, events, and runs
 */

// Initialize Dexie database
const db = new Dexie('RoundRobinRopingDB');

// Define database schema
// Version 1 of the database
db.version(1).stores({
    // Ropers table: stores information about individual ropers
    // Primary key: id (auto-incremented)
    // Indexes: name, position for faster queries
    ropers: '++id, name, position, skillLevel',

    // Events table: stores roping events
    // Primary key: id (auto-incremented)
    // Indexes: name, date for sorting and filtering
    events: '++id, name, date, createdAt',

    // Runs table: stores individual team runs/times
    // Primary key: id (auto-incremented)
    // Indexes: eventId for filtering by event, time for sorting results
    runs: '++id, eventId, headerId, heelerId, time, round'
});

// Version 2: Add penalties support to events
db.version(2).stores({
    ropers: '++id, name, position, skillLevel',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round'
}).upgrade(tx => {
    // Migrate existing events to have default penalties
    return tx.table('events').toCollection().modify(event => {
        if (!event.penalties) {
            event.penalties = [
                { name: 'One Leg', seconds: 5 },
                { name: 'Barrier', seconds: 5 }
            ];
        }
    });
});

// Version 3: Migrate runs from boolean penalty fields to penalties array
db.version(3).stores({
    ropers: '++id, name, position, skillLevel',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round'
}).upgrade(tx => {
    // Migrate existing runs to use penalties array
    return tx.table('runs').toCollection().modify(run => {
        // Convert old boolean fields to array format
        // Array index 0 = One Leg, index 1 = Barrier
        if (!run.penalties) {
            run.penalties = [
                run.penaltyOneLeg || false,
                run.penaltyBarrier || false
            ];
        }
        // Clean up old fields (optional, but keeps database cleaner)
        delete run.penaltyOneLeg;
        delete run.penaltyBarrier;
    });
});

// Version 4: Add soft delete support to ropers
db.version(4).stores({
    ropers: '++id, name, position, skillLevel',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round'
}).upgrade(tx => {
    // Add deleted field to all existing ropers (default to false)
    return tx.table('ropers').toCollection().modify(roper => {
        if (roper.deleted === undefined) {
            roper.deleted = false;
        }
    });
});

// Version 5: Add placesToPay field to events
db.version(5).stores({
    ropers: '++id, name, position, skillLevel',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round'
}).upgrade(tx => {
    // Add placesToPay field to all existing events (default to null = no limit)
    return tx.table('events').toCollection().modify(event => {
        if (event.placesToPay === undefined) {
            event.placesToPay = null;
        }
    });
});

// Version 6: Add money management fields to events
db.version(6).stores({
    ropers: '++id, name, position, skillLevel',
    events: '++id, name, date, createdAt',
    runs: '++id, eventId, headerId, heelerId, time, round'
}).upgrade(tx => {
    // Add money management fields to all existing events
    return tx.table('events').toCollection().modify(event => {
        if (event.entryFee === undefined) {
            event.entryFee = null; // Entry fee per person
        }
        if (event.stockFeePercent === undefined) {
            event.stockFeePercent = null; // Stock fee percentage (whole number)
        }
        if (event.payouts === undefined) {
            event.payouts = []; // Array of payout objects [{place, headerAmount, heelerAmount}]
        }
    });
});

/**
 * Database Helper Functions
 * These functions provide a clean API for CRUD operations
 */

const dbHelpers = {
    // ==================== ROPERS ====================

    /**
     * Add a new roper to the database
     * @param {Object} roper - Roper object with name, position, skillLevel
     * @returns {Promise<number>} - ID of the newly added roper
     */
    async addRoper(roper) {
        return await db.ropers.add({
            name: roper.name,
            position: roper.position, // 'header' or 'heeler'
            skillLevel: roper.skillLevel, // 1-10
            deleted: false,
            createdAt: new Date()
        });
    },

    /**
     * Get all ropers from the database (excluding deleted ropers)
     * @returns {Promise<Array>} - Array of non-deleted ropers
     */
    async getAllRopers() {
        const allRopers = await db.ropers.toArray();
        return allRopers.filter(r => !r.deleted);
    },

    /**
     * Get all ropers including deleted ones (for displaying in event results)
     * @returns {Promise<Array>} - Array of all ropers
     */
    async getAllRopersIncludingDeleted() {
        return await db.ropers.toArray();
    },

    /**
     * Get ropers filtered by position (excluding deleted ropers)
     * @param {string} position - 'header' or 'heeler'
     * @returns {Promise<Array>} - Array of non-deleted ropers matching position
     */
    async getRopersByPosition(position) {
        return await db.ropers.where('position').equals(position).filter(r => !r.deleted).toArray();
    },

    /**
     * Update a roper's information
     * @param {number} id - Roper ID
     * @param {Object} updates - Object with fields to update
     * @returns {Promise<number>} - Number of records updated
     */
    async updateRoper(id, updates) {
        return await db.ropers.update(id, updates);
    },

    /**
     * Soft delete a roper (marks as deleted rather than removing from DB)
     * @param {number} id - Roper ID
     * @returns {Promise<number>} - Number of records updated
     */
    async deleteRoper(id) {
        return await db.ropers.update(id, { deleted: true });
    },

    /**
     * Check if a roper is used in any events
     * @param {number} roperId - Roper ID
     * @returns {Promise<{isUsed: boolean, eventCount: number, events: Array}>}
     */
    async isRoperUsedInEvents(roperId) {
        const events = await db.events.toArray();
        const usedInEvents = events.filter(event =>
            event.roperIds && event.roperIds.includes(roperId)
        );

        return {
            isUsed: usedInEvents.length > 0,
            eventCount: usedInEvents.length,
            events: usedInEvents
        };
    },

    /**
     * Get a single roper by ID
     * @param {number} id - Roper ID
     * @returns {Promise<Object>} - Roper object
     */
    async getRoper(id) {
        return await db.ropers.get(id);
    },

    // ==================== EVENTS ====================

    /**
     * Create a new event with team pairings
     * @param {Object} event - Event object with name, date, roperIds array, and optional money management fields
     * @returns {Promise<number>} - ID of the newly created event
     */
    async createEvent(event) {
        const eventId = await db.events.add({
            name: event.name,
            date: event.date,
            roperIds: event.roperIds, // Array of participating roper IDs
            pairings: event.pairings, // Array of team pairings [{headerId, heelerId, round}]
            penalties: event.penalties || [
                { name: 'One Leg', seconds: 5 },
                { name: 'Barrier', seconds: 5 }
            ], // Array of penalty objects
            placesToPay: event.placesToPay || null, // Number of places that will receive payouts (null = no limit)
            entryFee: event.entryFee || null, // Entry fee per person
            stockFeePercent: event.stockFeePercent || null, // Stock fee percentage
            payouts: event.payouts || [], // Array of payout objects [{place, headerAmount, heelerAmount}]
            createdAt: new Date(),
            status: 'active' // 'active' or 'completed'
        });

        // Create run records for each pairing
        if (event.pairings && event.pairings.length > 0) {
            const runs = event.pairings.map(pairing => ({
                eventId: eventId,
                headerId: pairing.headerId,
                heelerId: pairing.heelerId,
                round: pairing.round,
                time: null, // Time will be recorded later
                completed: false
            }));

            await db.runs.bulkAdd(runs);
        }

        return eventId;
    },

    /**
     * Get all events
     * @returns {Promise<Array>} - Array of all events, sorted by date (newest first)
     */
    async getAllEvents() {
        return await db.events.orderBy('date').reverse().toArray();
    },

    /**
     * Get a single event by ID
     * @param {number} id - Event ID
     * @returns {Promise<Object>} - Event object
     */
    async getEvent(id) {
        return await db.events.get(id);
    },

    /**
     * Update an event
     * @param {number} id - Event ID
     * @param {Object} updates - Object with fields to update
     * @returns {Promise<number>} - Number of records updated
     */
    async updateEvent(id, updates) {
        return await db.events.update(id, updates);
    },

    /**
     * Delete an event and all associated runs
     * @param {number} id - Event ID
     * @returns {Promise<void>}
     */
    async deleteEvent(id) {
        // Delete all runs for this event
        await db.runs.where('eventId').equals(id).delete();
        // Delete the event
        return await db.events.delete(id);
    },

    // ==================== RUNS ====================

    /**
     * Record a time for a run
     * @param {number} runId - Run ID
     * @param {Object} timeData - Object with time, rawTime, penalties
     * @returns {Promise<number>} - Number of records updated
     */
    async recordRunTime(runId, timeData) {
        return await db.runs.update(runId, {
            time: timeData.finalTime,
            rawTime: timeData.rawTime,
            penalties: timeData.penalties || [],
            completed: true,
            recordedAt: new Date(),
            isRerun: false
        });
    },

    /**
     * Get all runs for an event
     * @param {number} eventId - Event ID
     * @returns {Promise<Array>} - Array of runs for the event
     */
    async getRunsByEvent(eventId) {
        return await db.runs.where('eventId').equals(eventId).toArray();
    },

    /**
     * Get runs with full roper details (joins with ropers table)
     * @param {number} eventId - Event ID
     * @returns {Promise<Array>} - Array of runs with header and heeler names
     */
    async getRunsWithRopers(eventId) {
        const runs = await db.runs.where('eventId').equals(eventId).toArray();

        // Enhance each run with roper details
        const enhancedRuns = await Promise.all(runs.map(async (run) => {
            const header = await db.ropers.get(run.headerId);
            const heeler = await db.ropers.get(run.heelerId);

            // Add (Deleted) indicator to names if roper is deleted
            const headerName = header ? (header.deleted ? `${header.name} (Deleted)` : header.name) : 'Unknown';
            const heelerName = heeler ? (heeler.deleted ? `${heeler.name} (Deleted)` : heeler.name) : 'Unknown';

            return {
                ...run,
                headerName: headerName,
                heelerName: heelerName,
                headerSkill: header ? header.skillLevel : 0,
                heelerSkill: heeler ? heeler.skillLevel : 0,
                headerDeleted: header ? header.deleted : false,
                heelerDeleted: heeler ? heeler.deleted : false
            };
        }));

        return enhancedRuns;
    },

    /**
     * Get results/standings for an event (sorted by time)
     * @param {number} eventId - Event ID
     * @returns {Promise<Array>} - Array of completed runs sorted by time
     */
    async getEventResults(eventId) {
        const runsWithRopers = await this.getRunsWithRopers(eventId);

        // Filter only completed runs and sort by time
        return runsWithRopers
            .filter(run => run.completed && run.time !== null)
            .sort((a, b) => a.time - b.time);
    },

    /**
     * Get individual roper statistics for an event
     * @param {number} eventId - Event ID
     * @returns {Promise<Object>} - Object with headers and heelers arrays
     */
    async getRoperStatistics(eventId) {
        const runs = await this.getRunsWithRopers(eventId);

        // Track stats for each roper
        const headerStats = {};
        const heelerStats = {};

        runs.forEach(run => {
            // Track header stats
            if (!headerStats[run.headerId]) {
                headerStats[run.headerId] = {
                    id: run.headerId,
                    name: run.headerName,
                    skillLevel: run.headerSkill,
                    catches: 0,
                    noTimes: 0,
                    totalRuns: 0,
                    totalTime: 0,
                    times: []
                };
            }

            // Track heeler stats
            if (!heelerStats[run.heelerId]) {
                heelerStats[run.heelerId] = {
                    id: run.heelerId,
                    name: run.heelerName,
                    skillLevel: run.heelerSkill,
                    catches: 0,
                    noTimes: 0,
                    totalRuns: 0,
                    totalTime: 0,
                    times: []
                };
            }

            // Determine run status
            // isCatch: completed run with valid time
            // isNoTime: completed run with no time or time >= 999999
            // incomplete: not completed at all (no time entered yet)
            const isCatch = run.completed && run.time !== null && run.time < 999999;
            const isExplicitNoTime = run.completed && (run.time === null || run.time >= 999999);
            const isIncomplete = !run.completed;

            // Update header stats
            if (run.completed) {
                headerStats[run.headerId].totalRuns++;
            }
            if (isCatch) {
                headerStats[run.headerId].catches++;
                headerStats[run.headerId].totalTime += run.time;
                headerStats[run.headerId].times.push(run.time);
            } else if (isExplicitNoTime || isIncomplete) {
                headerStats[run.headerId].noTimes++;
            }

            // Update heeler stats
            if (run.completed) {
                heelerStats[run.heelerId].totalRuns++;
            }
            if (isCatch) {
                heelerStats[run.heelerId].catches++;
                heelerStats[run.heelerId].totalTime += run.time;
                heelerStats[run.heelerId].times.push(run.time);
            } else if (isExplicitNoTime || isIncomplete) {
                heelerStats[run.heelerId].noTimes++;
            }
        });

        // Calculate averages and sort
        const processStats = (stats) => {
            return Object.values(stats).map(stat => ({
                ...stat,
                avgTime: stat.catches > 0 ? stat.totalTime / stat.catches : 999999,
                bestTime: stat.times.length > 0 ? Math.min(...stat.times) : null
            })).sort((a, b) => {
                // Sort by catches (descending), then by average time (ascending), then alphabetically by name
                if (b.catches !== a.catches) {
                    return b.catches - a.catches;
                }
                if (Math.abs(a.avgTime - b.avgTime) > 0.001) {
                    return a.avgTime - b.avgTime;
                }
                // If catches and avgTime are the same, sort alphabetically
                return a.name.localeCompare(b.name);
            });
        };

        return {
            headers: processStats(headerStats),
            heelers: processStats(heelerStats)
        };
    },

    /**
     * Delete a run
     * @param {number} id - Run ID
     * @returns {Promise<void>}
     */
    async deleteRun(id) {
        return await db.runs.delete(id);
    },

    // ==================== STATISTICS ====================

    /**
     * Get database statistics for the dashboard (excludes deleted ropers)
     * @returns {Promise<Object>} - Object with counts
     */
    async getStats() {
        const allRopers = await db.ropers.toArray();
        const roperCount = allRopers.filter(r => !r.deleted).length;
        const eventCount = await db.events.count();
        const runCount = await db.runs.count();

        return {
            ropers: roperCount,
            events: eventCount,
            runs: runCount
        };
    },

    // ==================== UTILITY ====================

    /**
     * Clear all data from the database (for testing/reset)
     * @returns {Promise<void>}
     */
    async clearAllData() {
        await db.ropers.clear();
        await db.events.clear();
        await db.runs.clear();
    }
};

// Export the database and helper functions
window.db = db;
window.dbHelpers = dbHelpers;

console.log('Database initialized successfully');
