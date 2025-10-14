/**
 * View Results Page JavaScript
 * Handles displaying event results and standings
 */

/**
 * Load the results page
 */
async function loadResultsPage() {
    try {
        // Reset page state
        document.getElementById('results-event-select').value = '';
        document.getElementById('results-section').classList.add('hidden');

        const events = await dbHelpers.getAllEvents();
        const select = document.getElementById('results-event-select');

        // Keep the default option
        select.innerHTML = '<option value="">Choose an event...</option>';

        if (events.length === 0) {
            select.innerHTML += '<option value="" disabled>No events available</option>';
            return;
        }

        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.name} - ${app.formatDate(event.date)}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading results page:', error);
        app.showNotification('Error loading page', 'error');
    }
}

/**
 * Handle event selection change
 */
async function handleResultsEventChange(e) {
    const eventId = parseInt(e.target.value);

    if (!eventId) {
        document.getElementById('results-section').classList.add('hidden');
        return;
    }

    await displayResults(eventId);
}

/**
 * Display results for an event
 * @param {number} eventId - Event ID
 */
async function displayResults(eventId) {
    try {
        const event = await dbHelpers.getEvent(eventId);
        const allRuns = await dbHelpers.getRunsByEvent(eventId);
        const completedRuns = allRuns.filter(r => r.completed);
        const stats = await dbHelpers.getRoperStatistics(eventId);

        const resultsSection = document.getElementById('results-section');
        const resultsContainer = document.getElementById('results-container');

        // Check if all runs are completed
        const allCompleted = allRuns.length === completedRuns.length;
        const isEventCompleted = event.status === 'completed';

        let html = '';

        // Show event status and completion button
        if (completedRuns.length > 0) {
            if (isEventCompleted) {
                html += `
                    <div class="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="text-sm text-green-800">
                                <strong>✓ Event Completed</strong><br>
                                This event is finalized. ${completedRuns.length} of ${allRuns.length} runs recorded.
                            </p>
                        </div>
                        <button onclick="markEventActive(${eventId})"
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap">
                            Reactivate Event
                        </button>
                    </div>
                `;
            } else if (allCompleted) {
                html += `
                    <div class="mb-4 p-4 bg-blue-50 border border-blue-300 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="text-sm text-blue-800">
                                <strong>All times recorded!</strong><br>
                                All ${allRuns.length} runs have been completed. Ready to finalize this event?
                            </p>
                        </div>
                        <button onclick="markEventCompleted(${eventId})"
                                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap">
                            Mark as Completed
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="text-sm text-yellow-800">
                                <strong>⚠ Warning:</strong> Not all times have been entered yet.<br>
                                ${completedRuns.length} of ${allRuns.length} runs completed.
                            </p>
                        </div>
                        <button onclick="goToRecordTimes(${eventId})"
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap">
                            Record Times →
                        </button>
                    </div>
                `;
            }
        }

        if (completedRuns.length === 0) {
            html += `
                <div class="p-8 text-center">
                    <p class="text-gray-500 italic mb-4">No completed runs yet.</p>
                    <button onclick="goToRecordTimes(${eventId})"
                            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                        Go to Record Times →
                    </button>
                </div>
            `;
            resultsContainer.innerHTML = html;
            resultsSection.classList.remove('hidden');
            return;
        }

        // Headers Rankings
        html += `
            <div class="mb-6">
                <h3 class="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <span class="inline-block w-4 h-4 rounded-full bg-blue-600"></span>
                    Header Rankings
                </h3>
                <div class="overflow-x-auto -mx-3 sm:mx-0">
                    <table class="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-xs sm:text-base">
                        <thead>
                            <tr class="bg-blue-100">
                                <th class="border border-blue-200 p-1 sm:p-3 text-left">Rank</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-left">Name</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">Runs</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">Catch</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">NT</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">Total</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">Avg</th>
                                <th class="border border-blue-200 p-1 sm:p-3 text-center">Best</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.headers.map((header, index, array) => {
                                // Calculate actual rank based on ties
                                let actualRank = 1;
                                for (let i = 0; i < index; i++) {
                                    if (array[i].catches !== header.catches || Math.abs(array[i].avgTime - header.avgTime) > 0.001) {
                                        actualRank = i + 2;
                                    }
                                }

                                // Check if tied with previous
                                let isTied = false;
                                if (index > 0) {
                                    const prev = array[index - 1];
                                    isTied = prev.catches === header.catches && Math.abs(prev.avgTime - header.avgTime) < 0.001;
                                }

                                if (!isTied && index > 0) {
                                    actualRank = index + 1;
                                }

                                let rankBadge = `<span class="font-bold text-gray-700">${actualRank}</span>`;
                                if (actualRank === 1 && header.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 font-bold">1</span>`;
                                } else if (actualRank === 2 && header.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-700 font-bold">2</span>`;
                                } else if (actualRank === 3 && header.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-400 text-orange-900 font-bold">3</span>`;
                                }

                                return `
                                    <tr class="${actualRank <= 3 && header.catches > 0 ? 'bg-blue-50 font-semibold' : ''}">
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center">${rankBadge}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3">${header.name}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center font-bold text-gray-700">${header.totalRuns}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center font-bold text-green-600">${header.catches}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center ${header.noTimes > 0 ? 'text-red-600' : 'text-gray-400'}">${header.noTimes}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center font-mono">${header.catches > 0 ? app.formatTime(header.totalTime) + 's' : '—'}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center font-mono">${header.catches > 0 ? app.formatTime(header.avgTime) + 's' : '—'}</td>
                                        <td class="border border-blue-200 p-1 sm:p-3 text-center font-mono">${header.bestTime ? app.formatTime(header.bestTime) + 's' : '—'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Heelers Rankings
        html += `
            <div class="mb-6">
                <h3 class="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span class="inline-block w-4 h-4 rounded-full bg-green-600"></span>
                    Heeler Rankings
                </h3>
                <div class="overflow-x-auto -mx-3 sm:mx-0">
                    <table class="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-xs sm:text-base">
                        <thead>
                            <tr class="bg-green-100">
                                <th class="border border-green-200 p-1 sm:p-3 text-left">Rank</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-left">Name</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">Runs</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">Catch</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">NT</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">Total</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">Avg</th>
                                <th class="border border-green-200 p-1 sm:p-3 text-center">Best</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.heelers.map((heeler, index, array) => {
                                // Calculate actual rank based on ties
                                let actualRank = 1;
                                for (let i = 0; i < index; i++) {
                                    if (array[i].catches !== heeler.catches || Math.abs(array[i].avgTime - heeler.avgTime) > 0.001) {
                                        actualRank = i + 2;
                                    }
                                }

                                // Check if tied with previous
                                let isTied = false;
                                if (index > 0) {
                                    const prev = array[index - 1];
                                    isTied = prev.catches === heeler.catches && Math.abs(prev.avgTime - heeler.avgTime) < 0.001;
                                }

                                if (!isTied && index > 0) {
                                    actualRank = index + 1;
                                }

                                let rankBadge = `<span class="font-bold text-gray-700">${actualRank}</span>`;
                                if (actualRank === 1 && heeler.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 font-bold">1</span>`;
                                } else if (actualRank === 2 && heeler.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-700 font-bold">2</span>`;
                                } else if (actualRank === 3 && heeler.catches > 0) {
                                    rankBadge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-400 text-orange-900 font-bold">3</span>`;
                                }

                                return `
                                    <tr class="${actualRank <= 3 && heeler.catches > 0 ? 'bg-green-50 font-semibold' : ''}">
                                        <td class="border border-green-200 p-1 sm:p-3 text-center">${rankBadge}</td>
                                        <td class="border border-green-200 p-1 sm:p-3">${heeler.name}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center font-bold text-gray-700">${heeler.totalRuns}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center font-bold text-green-600">${heeler.catches}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center ${heeler.noTimes > 0 ? 'text-red-600' : 'text-gray-400'}">${heeler.noTimes}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center font-mono">${heeler.catches > 0 ? app.formatTime(heeler.totalTime) + 's' : '—'}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center font-mono">${heeler.catches > 0 ? app.formatTime(heeler.avgTime) + 's' : '—'}</td>
                                        <td class="border border-green-200 p-1 sm:p-3 text-center font-mono">${heeler.bestTime ? app.formatTime(heeler.bestTime) + 's' : '—'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Individual Statistics
        html += await generateIndividualStatistics(eventId, stats);

        // Export button
        html += `
            <div class="mt-6 flex justify-center">
                <button onclick="exportResultsToCSV(${eventId})"
                        class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export Results to CSV
                </button>
            </div>
        `;

        resultsContainer.innerHTML = html;
        resultsSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error displaying results:', error);
        app.showNotification('Error loading results', 'error');
    }
}

/**
 * Generate individual statistics section showing all times per roper
 * @param {number} eventId - Event ID
 * @param {Object} stats - Statistics object with headers and heelers
 * @returns {Promise<string>} - HTML string
 */
async function generateIndividualStatistics(eventId, stats) {
    const runs = await dbHelpers.getRunsWithRopers(eventId);

    // Group runs by roper
    const headerRuns = {};
    const heelerRuns = {};

    runs.forEach(run => {
        if (run.completed) {
            // Group by header
            if (!headerRuns[run.headerId]) {
                headerRuns[run.headerId] = {
                    name: run.headerName,
                    runs: []
                };
            }
            headerRuns[run.headerId].runs.push({
                partner: run.heelerName,
                time: run.time,
                isCatch: run.time !== null && run.time < 999999
            });

            // Group by heeler
            if (!heelerRuns[run.heelerId]) {
                heelerRuns[run.heelerId] = {
                    name: run.heelerName,
                    runs: []
                };
            }
            heelerRuns[run.heelerId].runs.push({
                partner: run.headerName,
                time: run.time,
                isCatch: run.time !== null && run.time < 999999
            });
        }
    });

    let html = `
        <div class="mt-8">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Individual Run Details</h3>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Headers Details -->
                <div>
                    <h4 class="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <span class="inline-block w-3 h-3 rounded-full bg-blue-600"></span>
                        Headers
                    </h4>
                    <div class="space-y-3">
                        ${stats.headers.map(header => {
                            const roperRuns = headerRuns[header.id];
                            if (!roperRuns) return '';

                            return `
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <div class="font-semibold text-blue-900 mb-2">${header.name}</div>
                                    <div class="text-sm space-y-1">
                                        ${roperRuns.runs.map(run => `
                                            <div class="flex justify-between items-center py-1 border-b border-blue-100 last:border-0">
                                                <span class="text-gray-700">w/ ${run.partner}</span>
                                                <span class="font-mono ${run.isCatch ? 'text-green-600 font-semibold' : 'text-red-600'}">${run.isCatch ? app.formatTime(run.time) + 's' : 'NT'}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="mt-3 pt-3 border-t border-blue-200 space-y-1">
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Catches / No Times:</span>
                                            <span>${header.catches} / ${header.noTimes}</span>
                                        </div>
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Total Time:</span>
                                            <span class="text-blue-700">${header.catches > 0 ? app.formatTime(header.totalTime) + 's' : '—'}</span>
                                        </div>
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Average Time:</span>
                                            <span class="text-blue-700">${header.catches > 0 ? app.formatTime(header.avgTime) + 's' : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Heelers Details -->
                <div>
                    <h4 class="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <span class="inline-block w-3 h-3 rounded-full bg-green-600"></span>
                        Heelers
                    </h4>
                    <div class="space-y-3">
                        ${stats.heelers.map(heeler => {
                            const roperRuns = heelerRuns[heeler.id];
                            if (!roperRuns) return '';

                            return `
                                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div class="font-semibold text-green-900 mb-2">${heeler.name}</div>
                                    <div class="text-sm space-y-1">
                                        ${roperRuns.runs.map(run => `
                                            <div class="flex justify-between items-center py-1 border-b border-green-100 last:border-0">
                                                <span class="text-gray-700">w/ ${run.partner}</span>
                                                <span class="font-mono ${run.isCatch ? 'text-green-600 font-semibold' : 'text-red-600'}">${run.isCatch ? app.formatTime(run.time) + 's' : 'NT'}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="mt-3 pt-3 border-t border-green-200 space-y-1">
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Catches / No Times:</span>
                                            <span>${heeler.catches} / ${heeler.noTimes}</span>
                                        </div>
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Total Time:</span>
                                            <span class="text-green-700">${heeler.catches > 0 ? app.formatTime(heeler.totalTime) + 's' : '—'}</span>
                                        </div>
                                        <div class="flex justify-between text-sm font-semibold">
                                            <span class="text-gray-700">Average Time:</span>
                                            <span class="text-green-700">${heeler.catches > 0 ? app.formatTime(heeler.avgTime) + 's' : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}

/**
 * Export results to CSV file
 * @param {number} eventId - Event ID
 */
async function exportResultsToCSV(eventId) {
    try {
        const event = await dbHelpers.getEvent(eventId);
        const stats = await dbHelpers.getRoperStatistics(eventId);
        const runs = await dbHelpers.getRunsWithRopers(eventId);

        // Create CSV content
        let csv = '';

        // Event header
        csv += `Event: ${event.name}\n`;
        csv += `Date: ${app.formatDate(event.date)}\n`;
        csv += `Status: ${event.status === 'completed' ? 'Completed' : 'Active'}\n`;
        csv += `\n`;

        // Header Rankings
        csv += `HEADER RANKINGS\n`;
        csv += `Rank,Name,Catches,No Times,Total Time,Avg Time,Best Time\n`;
        stats.headers.forEach((header, index) => {
            csv += `${index + 1},`;
            csv += `"${header.name}",`;
            csv += `${header.catches},`;
            csv += `${header.noTimes},`;
            csv += `${header.catches > 0 ? header.totalTime.toFixed(2) : 'N/A'},`;
            csv += `${header.catches > 0 ? header.avgTime.toFixed(2) : 'N/A'},`;
            csv += `${header.bestTime ? header.bestTime.toFixed(2) : 'N/A'}\n`;
        });
        csv += `\n`;

        // Heeler Rankings
        csv += `HEELER RANKINGS\n`;
        csv += `Rank,Name,Catches,No Times,Total Time,Avg Time,Best Time\n`;
        stats.heelers.forEach((heeler, index) => {
            csv += `${index + 1},`;
            csv += `"${heeler.name}",`;
            csv += `${heeler.catches},`;
            csv += `${heeler.noTimes},`;
            csv += `${heeler.catches > 0 ? heeler.totalTime.toFixed(2) : 'N/A'},`;
            csv += `${heeler.catches > 0 ? heeler.avgTime.toFixed(2) : 'N/A'},`;
            csv += `${heeler.bestTime ? heeler.bestTime.toFixed(2) : 'N/A'}\n`;
        });
        csv += `\n`;

        // All Runs Detail
        csv += `ALL RUNS\n`;
        csv += `Team #,Header,Heeler,Time,Status\n`;
        runs.forEach((run, index) => {
            csv += `${index + 1},`;
            csv += `"${run.headerName}",`;
            csv += `"${run.heelerName}",`;
            if (run.completed) {
                const isCatch = run.time !== null && run.time < 999999;
                csv += `${isCatch ? run.time.toFixed(2) : 'NT'},`;
                csv += `${isCatch ? 'Completed' : 'No Time'}\n`;
            } else {
                csv += `N/A,Pending\n`;
            }
        });

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        // Generate filename with event name and date
        const filename = `${event.name.replace(/[^a-z0-9]/gi, '_')}_${event.date}_results.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        app.showNotification('Results exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting results:', error);
        app.showNotification('Error exporting results', 'error');
    }
}

/**
 * Mark event as completed
 * @param {number} eventId - Event ID
 */
async function markEventCompleted(eventId) {
    try {
        const confirmed = await app.confirm(
            'Mark this event as completed? This will prevent any further time entries or modifications.',
            'Complete Event'
        );

        if (!confirmed) return;

        await dbHelpers.updateEvent(eventId, { status: 'completed' });

        app.showNotification('Event marked as completed!', 'success');

        // Refresh the display
        await displayResults(eventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error marking event as completed:', error);
        app.showNotification('Error updating event status', 'error');
    }
}

/**
 * Mark event as active
 * @param {number} eventId - Event ID
 */
async function markEventActive(eventId) {
    try {
        const confirmed = await app.confirm(
            'Reactivate this event? You will be able to record times and make modifications again.',
            'Reactivate Event'
        );

        if (!confirmed) return;

        await dbHelpers.updateEvent(eventId, { status: 'active' });

        app.showNotification('Event reactivated!', 'success');

        // Refresh the display
        await displayResults(eventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error reactivating event:', error);
        app.showNotification('Error updating event status', 'error');
    }
}

/**
 * Navigate to Record Times page with event pre-selected
 * @param {number} eventId - Event ID to select
 */
function goToRecordTimes(eventId) {
    router.navigate('record');
    setTimeout(() => {
        document.getElementById('record-event-select').value = eventId;
        document.getElementById('record-event-select').dispatchEvent(new Event('change'));
    }, 100);
}

// Export functions to global scope
window.markEventCompleted = markEventCompleted;
window.markEventActive = markEventActive;
window.exportResultsToCSV = exportResultsToCSV;
window.goToRecordTimes = goToRecordTimes;

// Set up event listener
document.getElementById('results-event-select').addEventListener('change', handleResultsEventChange);

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'results') {
        loadResultsPage();
    }
});

console.log('Results page script loaded');
