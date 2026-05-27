/**
 * Record Times Page JavaScript
 * Handles recording run times for teams
 */

let currentEventId = null;
let currentEditingRunId = null;

/**
 * Load the record times page
 */
async function loadRecordPage() {
    try {
        // Reset page state
        currentEventId = null;
        currentEditingRunId = null;

        // Reset the event selection dropdown
        document.getElementById('record-event-select').value = '';

        // Hide the teams section
        document.getElementById('record-teams-section').classList.add('hidden');

        await loadEventOptions('record-event-select');
    } catch (error) {
        console.error('Error loading record page:', error);
        app.showNotification('Error loading page', 'error');
    }
}

/**
 * Load event options for dropdown
 * @param {string} selectId - ID of the select element
 */
async function loadEventOptions(selectId) {
    try {
        const events = await dbHelpers.getAllEvents();
        const select = document.getElementById(selectId);

        // Keep the default option
        select.innerHTML = '<option value="">Choose an event...</option>';

        // Filter out completed events for record times page
        const activeEvents = events.filter(event => event.status !== 'completed');

        if (activeEvents.length === 0) {
            select.innerHTML += '<option value="" disabled>No active events available</option>';
            return;
        }

        activeEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.name} - ${app.formatDate(event.date)}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading event options:', error);
    }
}

/**
 * Handle event selection change
 */
async function handleRecordEventChange(e) {
    const eventId = parseInt(e.target.value);

    if (!eventId) {
        document.getElementById('record-teams-section').classList.add('hidden');
        updateRecordPageTitle(null);
        return;
    }

    currentEventId = eventId;
    await displayTeamsForRecording(eventId);
}

/**
 * Display teams for recording times
 * @param {number} eventId - Event ID
 */
async function displayTeamsForRecording(eventId) {
    try {
        const event = await db.events.get(eventId);
        const runs = await dbHelpers.getRunsWithRopers(eventId);
        const teamsList = document.getElementById('record-teams-list');
        const teamsSection = document.getElementById('record-teams-section');

        updateRecordPageTitle(event);

        if (runs.length === 0) {
            teamsList.innerHTML = '<p class="text-gray-500 italic">No teams found for this event.</p>';
            teamsSection.classList.remove('hidden');
            return;
        }

        // Check if event date is in the future
        const eventDate = app.parseLocalDate(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isEventInFuture = eventDate > today;

        if (isEventInFuture) {
            teamsList.innerHTML = `
                <div class="p-6 bg-yellow-50 rounded-lg border border-yellow-300 text-center">
                    <svg class="w-16 h-16 mx-auto text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Event Not Started</h3>
                    <p class="text-gray-600 mb-1">
                        This event is scheduled for <span class="font-semibold">${app.formatDate(event.date)}</span>
                    </p>
                    <p class="text-gray-500 text-sm">
                        You cannot record times until the event date arrives.
                    </p>
                </div>
            `;
            teamsSection.classList.remove('hidden');
            return;
        }

        // Event scoring mode
        const scoringType = event.scoringType || 'time';
        const isPoints = scoringType === 'points';
        const pointsTracking = event.pointsTracking || 'together';

        // Get event penalties (or use defaults if none) — only used for time events
        const penalties = event.penalties || [
            { name: 'One Leg', seconds: 5 },
            { name: 'Barrier', seconds: 5 }
        ];

        // Calculate progress
        const completedCount = runs.filter(r => r.completed).length;
        const totalRuns = runs.length;

        // Add progress indicator at the top (sticky)
        let progressHtml = `
            <div class="sticky top-0 z-10 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-300 shadow-md">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-blue-900">Recording Progress</h3>
                        <p class="text-sm text-blue-700">${completedCount} of ${totalRuns} runs completed</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold text-blue-900">${completedCount}/${totalRuns}</div>
                        <div class="text-sm text-blue-700">${totalRuns > 0 ? Math.round((completedCount / totalRuns) * 100) : 0}%</div>
                    </div>
                </div>
                <div class="mt-3 w-full bg-blue-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${totalRuns > 0 ? (completedCount / totalRuns) * 100 : 0}%"></div>
                </div>
            </div>
        `;

        teamsList.innerHTML = progressHtml + runs.map((run, index) => {
            const isEditing = currentEditingRunId === run.id;
            if (isPoints) {
                return renderPointsRunCard(run, index, isEditing, pointsTracking);
            }
            return renderTimeRunCard(run, index, isEditing, penalties);
        }).join('');

        teamsSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error displaying teams:', error);
        app.showNotification('Error loading teams', 'error');
    }
}

/**
 * Update the Record page heading based on the selected event's scoring type.
 * @param {Object} event - Event record (may have scoringType)
 */
function updateRecordPageTitle(event) {
    const title = document.getElementById('record-page-title');
    if (!title) return;
    const isPoints = event && event.scoringType === 'points';
    // Preserve the trailing tooltip child by only rewriting the leading text node
    const firstNode = title.firstChild;
    const label = isPoints ? 'Record Points' : 'Record Times';
    if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
        firstNode.textContent = label + '\n                            ';
    }
}

/**
 * Render a card for a time-based run (existing behavior).
 */
function renderTimeRunCard(run, index, isEditing, penalties) {
    const isNoTime = run.time === null || run.time === 999999;

    // Generate penalty checkboxes dynamically
    const penaltyCheckboxes = penalties.map((penalty, penaltyIndex) => {
        const penaltyId = `penalty-${penaltyIndex}-${run.id}`;
        const isChecked = isEditing && run.penalties && run.penalties[penaltyIndex];
        return `
            <label class="flex items-center gap-3 cursor-pointer bg-gray-50 hover:bg-gray-100 p-3 rounded-lg border border-gray-200 transition-colors">
                <input type="checkbox" id="${penaltyId}" data-penalty-index="${penaltyIndex}" data-penalty-seconds="${penalty.seconds}"
                       ${isChecked ? 'checked' : ''}
                       onchange="calculateFinalTime(${run.id})"
                       class="penalty-checkbox w-6 h-6 text-red-600 rounded focus:ring-2 focus:ring-red-500">
                <span class="text-base font-medium">${penalty.name} (+${penalty.seconds}s)</span>
            </label>
        `;
    }).join('');

    // Generate penalty display for completed runs
    const penaltyDisplay = run.penalties && run.penalties.length > 0
        ? run.penalties.map((applied, idx) => applied ? ` | +${penalties[idx].seconds}s ${penalties[idx].name}` : '').filter(Boolean).join('')
        : '';

    return `
            <div class="p-4 bg-gray-50 rounded-lg border ${run.completed ? 'border-green-300' : run.isRerun ? 'border-orange-400 border-2' : 'border-gray-200'} ${run.isRerun && !run.completed ? 'bg-orange-50' : ''}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex-grow">
                        <div class="flex items-center gap-2">
                            <span class="text-lg font-bold text-gray-400">#${index + 1}</span>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold">${run.headerName}</span>
                                    <span class="text-gray-400">&</span>
                                    <span class="font-semibold">${run.heelerName}</span>
                                </div>
                                ${run.completed && !isEditing ? `
                                    <div class="mt-1">
                                        ${isNoTime ? `
                                            <div class="text-sm text-red-600 font-semibold">
                                                NT (No Time)
                                            </div>
                                        ` : `
                                            <div class="text-sm text-green-600 font-semibold">
                                                Final Time: ${app.formatTime(run.time)}s
                                            </div>
                                            ${run.rawTime ? `
                                                <div class="text-xs text-gray-600">
                                                    Raw: ${app.formatTime(run.rawTime)}s${penaltyDisplay}
                                                </div>
                                            ` : ''}
                                        `}
                                    </div>
                                ` : run.isRerun && !run.completed ? `
                                    <div class="flex items-center gap-2 mt-1">
                                        <svg class="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                        </svg>
                                        <span class="text-sm font-semibold text-orange-600">Needs time entry</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ${run.completed && !isEditing ? `
                        <div class="flex gap-2">
                            <button onclick="editRunTime(${run.id})"
                                    class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                Edit
                            </button>
                            <button onclick="markForRerun(${run.id})"
                                    class="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm">
                                Rerun
                            </button>
                        </div>
                    ` : ''}
                </div>
                ${!run.completed || isEditing ? `
                    <div class="space-y-2">
                        <div class="flex gap-2 items-end">
                            <div class="flex-grow">
                                <label class="block text-xs font-medium mb-1">Raw Time (seconds)</label>
                                <input type="number" id="raw-time-${run.id}" step="0.01" min="0"
                                       placeholder="0.00"
                                       value="${isEditing && run.rawTime ? run.rawTime : ''}"
                                       oninput="calculateFinalTime(${run.id})"
                                       class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            ${isEditing ? `
                                <button onclick="saveEditedTime(${run.id})"
                                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">
                                    Save
                                </button>
                                <button onclick="saveEditedNoTime(${run.id})"
                                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap">
                                    No Time
                                </button>
                                <button onclick="cancelEdit()"
                                        class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap">
                                    Cancel
                                </button>
                            ` : `
                                <button onclick="recordTime(${run.id})"
                                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">
                                    Record
                                </button>
                                <button onclick="recordNoTime(${run.id})"
                                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap">
                                    No Time
                                </button>
                            `}
                        </div>
                        <div class="flex flex-col sm:flex-row gap-3 px-2">
                            ${penaltyCheckboxes}
                        </div>
                        <div id="final-time-${run.id}" class="text-sm font-semibold text-blue-600 px-2 ${isEditing && !isNoTime ? '' : 'hidden'}">
                            Final Time: <span id="final-time-value-${run.id}">${isEditing && !isNoTime ? app.formatTime(run.time) : '0.00'}</span>s
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
}

/**
 * Render a card for a points-based run.
 * @param {Object} run - Run record (may have points / headerPoints / heelerPoints)
 * @param {number} index - Index in the list
 * @param {boolean} isEditing - Whether this run is currently being edited
 * @param {string} pointsTracking - 'together' or 'separate'
 */
function renderPointsRunCard(run, index, isEditing, pointsTracking) {
    const isSeparate = pointsTracking === 'separate';
    // "No Score" = completed but all point fields are null
    const hasAnyPoints = run.points !== null && run.points !== undefined
        || run.headerPoints !== null && run.headerPoints !== undefined
        || run.heelerPoints !== null && run.heelerPoints !== undefined;
    const isNoScore = run.completed && !hasAnyPoints;

    const completedSummary = (() => {
        if (!run.completed || isEditing) return '';
        if (isNoScore) {
            return `<div class="text-sm text-red-600 font-semibold">NS (No Score)</div>`;
        }
        if (isSeparate) {
            const h = run.headerPoints ?? 0;
            const e = run.heelerPoints ?? 0;
            return `
                <div class="text-sm text-green-600 font-semibold">
                    Header: ${h} | Heeler: ${e} | Total: ${h + e}
                </div>
            `;
        }
        return `<div class="text-sm text-green-600 font-semibold">Points: ${run.points ?? 0}</div>`;
    })();

    const inputs = isSeparate
        ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-medium mb-1">Header Points</label>
                    <input type="number" id="header-points-${run.id}" step="1" min="0"
                           placeholder="0"
                           value="${isEditing && run.headerPoints != null ? run.headerPoints : ''}"
                           class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Heeler Points</label>
                    <input type="number" id="heeler-points-${run.id}" step="1" min="0"
                           placeholder="0"
                           value="${isEditing && run.heelerPoints != null ? run.heelerPoints : ''}"
                           class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
        `
        : `
            <div class="flex-grow">
                <label class="block text-xs font-medium mb-1">Points</label>
                <input type="number" id="points-${run.id}" step="1" min="0"
                       placeholder="0"
                       value="${isEditing && run.points != null ? run.points : ''}"
                       class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
        `;

    const actionButtons = isEditing
        ? `
            <button onclick="saveEditedPoints(${run.id})"
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">
                Save
            </button>
            <button onclick="saveEditedNoScore(${run.id})"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap">
                No Score
            </button>
            <button onclick="cancelEdit()"
                    class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap">
                Cancel
            </button>
        `
        : `
            <button onclick="recordPoints(${run.id})"
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">
                Record
            </button>
            <button onclick="recordNoScore(${run.id})"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap">
                No Score
            </button>
        `;

    return `
        <div class="p-4 bg-gray-50 rounded-lg border ${run.completed ? 'border-green-300' : run.isRerun ? 'border-orange-400 border-2' : 'border-gray-200'} ${run.isRerun && !run.completed ? 'bg-orange-50' : ''}">
            <div class="flex items-center justify-between mb-3">
                <div class="flex-grow">
                    <div class="flex items-center gap-2">
                        <span class="text-lg font-bold text-gray-400">#${index + 1}</span>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-semibold">${run.headerName}</span>
                                <span class="text-gray-400">&</span>
                                <span class="font-semibold">${run.heelerName}</span>
                            </div>
                            ${completedSummary}
                            ${run.isRerun && !run.completed ? `
                                <div class="flex items-center gap-2 mt-1">
                                    <svg class="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-sm font-semibold text-orange-600">Needs score entry</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                ${run.completed && !isEditing ? `
                    <div class="flex gap-2">
                        <button onclick="editRunTime(${run.id})"
                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Edit
                        </button>
                        <button onclick="markForRerun(${run.id})"
                                class="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm">
                            Rerun
                        </button>
                    </div>
                ` : ''}
            </div>
            ${!run.completed || isEditing ? `
                <div class="space-y-2">
                    ${inputs}
                    <div class="flex gap-2 justify-end">
                        ${actionButtons}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Calculate final time with penalties
 * @param {number} runId - Run ID
 */
function calculateFinalTime(runId) {
    const rawTimeInput = document.getElementById(`raw-time-${runId}`);
    const finalTimeDisplay = document.getElementById(`final-time-${runId}`);
    const finalTimeValue = document.getElementById(`final-time-value-${runId}`);

    const rawTime = parseFloat(rawTimeInput.value);

    if (!isNaN(rawTime) && rawTime > 0) {
        let finalTime = rawTime;

        // Find all penalty checkboxes for this run and add their seconds
        const penaltyCheckboxes = document.querySelectorAll(`[id^="penalty-"][id$="-${runId}"]`);
        penaltyCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const penaltySeconds = parseFloat(checkbox.dataset.penaltySeconds) || 0;
                finalTime += penaltySeconds;
            }
        });

        finalTimeValue.textContent = finalTime.toFixed(2);
        finalTimeDisplay.classList.remove('hidden');
    } else {
        finalTimeDisplay.classList.add('hidden');
    }
}

/**
 * Record a time for a run
 * @param {number} runId - Run ID
 */
async function recordTime(runId) {
    try {
        const rawTimeInput = document.getElementById(`raw-time-${runId}`);
        const rawTime = parseFloat(rawTimeInput.value);

        if (isNaN(rawTime) || rawTime <= 0) {
            app.showNotification('Please enter a valid raw time', 'error');
            return;
        }

        // Calculate final time with penalties and collect penalty states
        let finalTime = rawTime;
        const penaltyCheckboxes = document.querySelectorAll(`[id^="penalty-"][id$="-${runId}"]`);
        const penalties = [];

        penaltyCheckboxes.forEach(checkbox => {
            const penaltyIndex = parseInt(checkbox.dataset.penaltyIndex);
            const isChecked = checkbox.checked;
            penalties[penaltyIndex] = isChecked;

            if (isChecked) {
                const penaltySeconds = parseFloat(checkbox.dataset.penaltySeconds) || 0;
                finalTime += penaltySeconds;
            }
        });

        await dbHelpers.recordRunTime(runId, {
            rawTime: rawTime,
            finalTime: finalTime,
            penalties: penalties
        });

        app.showNotification('Time recorded successfully!', 'success');

        // Refresh the display
        await displayTeamsForRecording(currentEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error recording time:', error);
        app.showNotification('Error recording time', 'error');
    }
}

/**
 * Record a "No Time" for a run (missed steer)
 * @param {number} runId - Run ID
 */
async function recordNoTime(runId) {
    try {
        const confirmed = await app.confirm('Record as No Time (NT)? This marks the run as complete with no score.');
        if (!confirmed) return;

        // Use a very large number (999999) to represent NT - will sort to bottom
        await dbHelpers.recordRunTime(runId, {
            rawTime: null,
            finalTime: 999999, // Sort NT runs to the bottom
            penalties: [] // No penalties for NT
        });

        app.showNotification('No Time recorded', 'success');

        // Refresh the display
        await displayTeamsForRecording(currentEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error recording no time:', error);
        app.showNotification('Error recording no time', 'error');
    }
}

/**
 * Edit an existing run time - toggles edit mode
 * @param {number} runId - Run ID
 */
async function editRunTime(runId) {
    currentEditingRunId = runId;
    await displayTeamsForRecording(currentEventId);

    // Trigger calculation to show final time
    setTimeout(() => {
        calculateFinalTime(runId);
    }, 100);
}

/**
 * Save edited time for a run
 * @param {number} runId - Run ID
 */
async function saveEditedTime(runId) {
    try {
        const rawTimeInput = document.getElementById(`raw-time-${runId}`);
        const rawTime = parseFloat(rawTimeInput.value);

        if (isNaN(rawTime) || rawTime <= 0) {
            app.showNotification('Please enter a valid raw time', 'error');
            return;
        }

        // Calculate final time with penalties and collect penalty states
        let finalTime = rawTime;
        const penaltyCheckboxes = document.querySelectorAll(`[id^="penalty-"][id$="-${runId}"]`);
        const penalties = [];

        penaltyCheckboxes.forEach(checkbox => {
            const penaltyIndex = parseInt(checkbox.dataset.penaltyIndex);
            const isChecked = checkbox.checked;
            penalties[penaltyIndex] = isChecked;

            if (isChecked) {
                const penaltySeconds = parseFloat(checkbox.dataset.penaltySeconds) || 0;
                finalTime += penaltySeconds;
            }
        });

        await dbHelpers.recordRunTime(runId, {
            rawTime: rawTime,
            finalTime: finalTime,
            penalties: penalties
        });

        app.showNotification('Time updated successfully!', 'success');

        // Clear edit mode and refresh
        currentEditingRunId = null;
        await displayTeamsForRecording(currentEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error saving edited time:', error);
        app.showNotification('Error updating time', 'error');
    }
}

/**
 * Save edited run as "No Time"
 * @param {number} runId - Run ID
 */
async function saveEditedNoTime(runId) {
    try {
        const confirmed = await app.confirm('Change to No Time (NT)? This marks the run as complete with no score.');
        if (!confirmed) return;

        // Use a very large number (999999) to represent NT - will sort to bottom
        await dbHelpers.recordRunTime(runId, {
            rawTime: null,
            finalTime: 999999, // Sort NT runs to the bottom
            penalties: [] // No penalties for NT
        });

        app.showNotification('Updated to No Time', 'success');

        // Clear edit mode and refresh
        currentEditingRunId = null;
        await displayTeamsForRecording(currentEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error updating to no time:', error);
        app.showNotification('Error updating time', 'error');
    }
}

/**
 * Read the points input(s) on a run card. Returns { points, headerPoints, heelerPoints }
 * (only the relevant fields will be populated). Returns null on invalid input.
 */
async function readPointsInputs(runId) {
    const event = await db.events.get(currentEventId);
    const isSeparate = (event?.pointsTracking || 'together') === 'separate';

    if (isSeparate) {
        const headerInput = document.getElementById(`header-points-${runId}`);
        const heelerInput = document.getElementById(`heeler-points-${runId}`);
        const h = parseFloat(headerInput.value);
        const e = parseFloat(heelerInput.value);
        if (isNaN(h) || isNaN(e) || h < 0 || e < 0) {
            app.showNotification('Please enter valid points for both header and heeler', 'error');
            return null;
        }
        return { headerPoints: h, heelerPoints: e };
    }

    const input = document.getElementById(`points-${runId}`);
    const p = parseFloat(input.value);
    if (isNaN(p) || p < 0) {
        app.showNotification('Please enter a valid points value', 'error');
        return null;
    }
    return { points: p };
}

/**
 * Record points for a new run.
 */
async function recordPoints(runId) {
    try {
        const data = await readPointsInputs(runId);
        if (!data) return;
        await dbHelpers.recordRunPoints(runId, data);
        app.showNotification('Points recorded successfully!', 'success');
        await displayTeamsForRecording(currentEventId);
        if (typeof updateStats === 'function') updateStats();
    } catch (error) {
        console.error('Error recording points:', error);
        app.showNotification('Error recording points', 'error');
    }
}

/**
 * Record a "No Score" for a points-based run.
 */
async function recordNoScore(runId) {
    try {
        const confirmed = await app.confirm('Record as No Score (NS)? This marks the run as complete with no score.');
        if (!confirmed) return;
        await dbHelpers.recordRunPoints(runId, { points: null, headerPoints: null, heelerPoints: null });
        app.showNotification('No Score recorded', 'success');
        await displayTeamsForRecording(currentEventId);
        if (typeof updateStats === 'function') updateStats();
    } catch (error) {
        console.error('Error recording no score:', error);
        app.showNotification('Error recording no score', 'error');
    }
}

/**
 * Save edited points for a run.
 */
async function saveEditedPoints(runId) {
    try {
        const data = await readPointsInputs(runId);
        if (!data) return;
        await dbHelpers.recordRunPoints(runId, data);
        app.showNotification('Points updated successfully!', 'success');
        currentEditingRunId = null;
        await displayTeamsForRecording(currentEventId);
        if (typeof updateStats === 'function') updateStats();
    } catch (error) {
        console.error('Error saving edited points:', error);
        app.showNotification('Error updating points', 'error');
    }
}

/**
 * Save edited points run as "No Score".
 */
async function saveEditedNoScore(runId) {
    try {
        const confirmed = await app.confirm('Change to No Score (NS)? This marks the run as complete with no score.');
        if (!confirmed) return;
        await dbHelpers.recordRunPoints(runId, { points: null, headerPoints: null, heelerPoints: null });
        app.showNotification('Updated to No Score', 'success');
        currentEditingRunId = null;
        await displayTeamsForRecording(currentEventId);
        if (typeof updateStats === 'function') updateStats();
    } catch (error) {
        console.error('Error updating to no score:', error);
        app.showNotification('Error updating points', 'error');
    }
}

/**
 * Cancel editing mode
 */
function cancelEdit() {
    currentEditingRunId = null;
    displayTeamsForRecording(currentEventId);
}

/**
 * Mark a run for rerun - clears the time and marks as incomplete
 * @param {number} runId - Run ID
 */
async function markForRerun(runId) {
    try {
        // Get the run to check if it has a time
        const run = await db.runs.get(runId);

        if (!run) {
            app.showNotification('Run not found', 'error');
            return;
        }

        // If the run has a time recorded, show confirmation
        if (run.time !== null && run.time !== undefined) {
            const confirmed = await app.confirm(
                'Mark this run for rerun?\n\n' +
                'This will clear the existing time and mark the team as needing to rerun. ' +
                'The run will be highlighted until a new time is entered.'
            );

            if (!confirmed) return;
        }

        // Clear all score fields (time and points) and mark as incomplete with rerun flag
        await db.runs.update(runId, {
            time: null,
            rawTime: null,
            points: null,
            headerPoints: null,
            heelerPoints: null,
            penalties: [],
            completed: false,
            recordedAt: null,
            isRerun: true
        });

        app.showNotification('Run marked for rerun', 'success');

        // Refresh the display
        await displayTeamsForRecording(currentEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error marking run for rerun:', error);
        app.showNotification('Error marking run for rerun', 'error');
    }
}

/**
 * Navigate to Results page with current event pre-selected
 */
async function goToResults() {
    if (!currentEventId) {
        app.showNotification('Please select an event first', 'error');
        return;
    }

    // Check if all times have been entered
    const allRuns = await dbHelpers.getRunsByEvent(currentEventId);
    const completedRuns = allRuns.filter(r => r.completed);
    const totalRuns = allRuns.length;
    const completedCount = completedRuns.length;

    if (completedCount < totalRuns) {
        // Show confirmation dialog
        const confirmed = await app.confirm(
            `Warning: Only ${completedCount} of ${totalRuns} times have been entered.\n\n` +
            `Continue to view results anyway?`
        );

        if (!confirmed) {
            // User chose to stay and enter more times
            return;
        }
    }

    // Navigate to results page
    router.navigate('results');

    // Wait for page to load, then select the event
    setTimeout(() => {
        const selectElement = document.getElementById('results-event-select');
        if (selectElement) {
            selectElement.value = currentEventId;
            // Trigger change event to load the results
            selectElement.dispatchEvent(new Event('change'));
        }
    }, 100);
}

// Set up event listener
document.getElementById('record-event-select').addEventListener('change', handleRecordEventChange);

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'record') {
        loadRecordPage();
    }
});

// Export functions to global scope
window.recordTime = recordTime;
window.recordNoTime = recordNoTime;
window.editRunTime = editRunTime;
window.saveEditedTime = saveEditedTime;
window.saveEditedNoTime = saveEditedNoTime;
window.cancelEdit = cancelEdit;
window.calculateFinalTime = calculateFinalTime;
window.goToResults = goToResults;
window.markForRerun = markForRerun;
window.recordPoints = recordPoints;
window.recordNoScore = recordNoScore;
window.saveEditedPoints = saveEditedPoints;
window.saveEditedNoScore = saveEditedNoScore;

console.log('Record page script loaded');
