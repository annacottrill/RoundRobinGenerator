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
        const runs = await dbHelpers.getRunsWithRopers(eventId);
        const teamsList = document.getElementById('record-teams-list');
        const teamsSection = document.getElementById('record-teams-section');

        if (runs.length === 0) {
            teamsList.innerHTML = '<p class="text-gray-500 italic">No teams found for this event.</p>';
            teamsSection.classList.remove('hidden');
            return;
        }

        teamsList.innerHTML = runs.map((run, index) => {
            const isEditing = currentEditingRunId === run.id;
            const isNoTime = run.time === null || run.time === 999999;

            return `
            <div class="p-4 bg-gray-50 rounded-lg border ${run.completed ? 'border-green-300' : 'border-gray-200'}">
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
                                                    Raw: ${app.formatTime(run.rawTime)}s
                                                    ${run.penaltyOneLeg ? ' | +5s One Leg' : ''}
                                                    ${run.penaltyBarrier ? ' | +5s Barrier' : ''}
                                                </div>
                                            ` : ''}
                                        `}
                                    </div>
                                ` : !run.completed ? `
                                    <div class="text-sm text-gray-500 mt-1">
                                        No time recorded
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ${run.completed && !isEditing ? `
                        <button onclick="editRunTime(${run.id})"
                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Edit
                        </button>
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
                        <div class="flex gap-4 px-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="penalty-leg-${run.id}"
                                       ${isEditing && run.penaltyOneLeg ? 'checked' : ''}
                                       onchange="calculateFinalTime(${run.id})"
                                       class="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500">
                                <span class="text-sm">One Leg (+5s)</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="penalty-barrier-${run.id}"
                                       ${isEditing && run.penaltyBarrier ? 'checked' : ''}
                                       onchange="calculateFinalTime(${run.id})"
                                       class="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500">
                                <span class="text-sm">Broke Barrier (+5s)</span>
                            </label>
                        </div>
                        <div id="final-time-${run.id}" class="text-sm font-semibold text-blue-600 px-2 ${isEditing && !isNoTime ? '' : 'hidden'}">
                            Final Time: <span id="final-time-value-${run.id}">${isEditing && !isNoTime ? app.formatTime(run.time) : '0.00'}</span>s
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        }).join('');

        teamsSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error displaying teams:', error);
        app.showNotification('Error loading teams', 'error');
    }
}

/**
 * Calculate final time with penalties
 * @param {number} runId - Run ID
 */
function calculateFinalTime(runId) {
    const rawTimeInput = document.getElementById(`raw-time-${runId}`);
    const penaltyLegCheckbox = document.getElementById(`penalty-leg-${runId}`);
    const penaltyBarrierCheckbox = document.getElementById(`penalty-barrier-${runId}`);
    const finalTimeDisplay = document.getElementById(`final-time-${runId}`);
    const finalTimeValue = document.getElementById(`final-time-value-${runId}`);

    const rawTime = parseFloat(rawTimeInput.value);

    if (!isNaN(rawTime) && rawTime > 0) {
        let finalTime = rawTime;

        // Add 5 seconds for each penalty
        if (penaltyLegCheckbox.checked) {
            finalTime += 5.0;
        }
        if (penaltyBarrierCheckbox.checked) {
            finalTime += 5.0;
        }

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
        const penaltyLegCheckbox = document.getElementById(`penalty-leg-${runId}`);
        const penaltyBarrierCheckbox = document.getElementById(`penalty-barrier-${runId}`);

        const rawTime = parseFloat(rawTimeInput.value);

        if (isNaN(rawTime) || rawTime <= 0) {
            app.showNotification('Please enter a valid raw time', 'error');
            return;
        }

        // Calculate final time with penalties
        let finalTime = rawTime;
        const penaltyOneLeg = penaltyLegCheckbox.checked;
        const penaltyBarrier = penaltyBarrierCheckbox.checked;

        if (penaltyOneLeg) finalTime += 5.0;
        if (penaltyBarrier) finalTime += 5.0;

        await dbHelpers.recordRunTime(runId, {
            rawTime: rawTime,
            finalTime: finalTime,
            penaltyOneLeg: penaltyOneLeg,
            penaltyBarrier: penaltyBarrier
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
            penaltyOneLeg: false,
            penaltyBarrier: false
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
        const penaltyLegCheckbox = document.getElementById(`penalty-leg-${runId}`);
        const penaltyBarrierCheckbox = document.getElementById(`penalty-barrier-${runId}`);

        const rawTime = parseFloat(rawTimeInput.value);

        if (isNaN(rawTime) || rawTime <= 0) {
            app.showNotification('Please enter a valid raw time', 'error');
            return;
        }

        // Calculate final time with penalties
        let finalTime = rawTime;
        const penaltyOneLeg = penaltyLegCheckbox.checked;
        const penaltyBarrier = penaltyBarrierCheckbox.checked;

        if (penaltyOneLeg) finalTime += 5.0;
        if (penaltyBarrier) finalTime += 5.0;

        await dbHelpers.recordRunTime(runId, {
            rawTime: rawTime,
            finalTime: finalTime,
            penaltyOneLeg: penaltyOneLeg,
            penaltyBarrier: penaltyBarrier
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
            penaltyOneLeg: false,
            penaltyBarrier: false
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
 * Cancel editing mode
 */
function cancelEdit() {
    currentEditingRunId = null;
    displayTeamsForRecording(currentEventId);
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

console.log('Record page script loaded');
