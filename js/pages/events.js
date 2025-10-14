/**
 * Create Event Page JavaScript
 * Handles event creation and pairing generation
 */

// Store current event being modified
let currentModifyEventId = null;

/**
 * Load the events page
 */
async function loadEventsPage() {
    try {
        await loadRopersForSelection();
        await loadEventsForModification();

        // Set default date to today
        document.getElementById('event-date').value = app.getTodayDate();
    } catch (error) {
        console.error('Error loading events page:', error);
        app.showNotification('Error loading page', 'error');
    }
}

/**
 * Load ropers for selection checkboxes
 * Separates headers and heelers into different sections
 */
async function loadRopersForSelection() {
    try {
        const ropers = await dbHelpers.getAllRopers();
        const headersContainer = document.getElementById('event-headers-selection');
        const heelersContainer = document.getElementById('event-heelers-selection');

        if (ropers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Add ropers first in Manage Ropers page</p>';
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Add ropers first in Manage Ropers page</p>';
            return;
        }

        // Filter headers (position = 'header' only)
        const headers = ropers.filter(r => r.position === 'header');

        // Filter heelers (position = 'heeler' only)
        const heelers = ropers.filter(r => r.position === 'heeler');

        // Sort headers and heelers alphabetically by name
        headers.sort((a, b) => a.name.localeCompare(b.name));
        heelers.sort((a, b) => a.name.localeCompare(b.name));

        // Populate headers section
        if (headers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No headers available</p>';
        } else {
            headersContainer.innerHTML = headers.map(roper => `
                <label class="flex items-center gap-2 p-2 rounded hover:bg-blue-100 cursor-pointer transition-colors">
                    <input type="checkbox" name="event-roper" value="${roper.id}"
                           class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                    <span class="flex-grow text-sm">
                        ${roper.name}
                    </span>
                </label>
            `).join('');
        }

        // Populate heelers section
        if (heelers.length === 0) {
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No heelers available</p>';
        } else {
            heelersContainer.innerHTML = heelers.map(roper => `
                <label class="flex items-center gap-2 p-2 rounded hover:bg-green-100 cursor-pointer transition-colors">
                    <input type="checkbox" name="event-roper" value="${roper.id}"
                           class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500">
                    <span class="flex-grow text-sm">
                        ${roper.name}
                    </span>
                </label>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading ropers for selection:', error);
    }
}

/**
 * Handle create event form submission
 */
async function handleCreateEvent(e) {
    e.preventDefault();

    try {
        const eventName = document.getElementById('event-name').value.trim();
        const eventDate = document.getElementById('event-date').value;

        // Get selected ropers
        const selectedRopers = Array.from(document.querySelectorAll('input[name="event-roper"]:checked'))
            .map(cb => parseInt(cb.value));

        if (!eventName || !eventDate) {
            app.showNotification('Please fill in all event details', 'error');
            return;
        }

        if (selectedRopers.length < 2) {
            app.showNotification('Please select at least 2 ropers', 'error');
            return;
        }

        // Get full roper objects
        const allRopers = await dbHelpers.getAllRopers();
        const participatingRopers = allRopers.filter(r => selectedRopers.includes(r.id));

        // Separate headers and heelers
        const headers = participatingRopers.filter(r => r.position === 'header');
        const heelers = participatingRopers.filter(r => r.position === 'heeler');

        if (headers.length === 0 || heelers.length === 0) {
            app.showNotification('You need at least one header and one heeler', 'error');
            return;
        }

        // Generate pairings
        const pairings = app.generateRoundRobinPairings(headers, heelers);

        if (pairings.length === 0) {
            app.showNotification('Could not generate pairings', 'error');
            return;
        }

        // Create event
        const eventId = await dbHelpers.createEvent({
            name: eventName,
            date: eventDate,
            roperIds: selectedRopers,
            pairings: pairings
        });

        app.showNotification(`Event "${eventName}" created with ${pairings.length} teams!`, 'success');

        // Display the pairings
        await displayPairings(eventId, pairings, participatingRopers);

        // Reset form
        e.target.reset();
        document.getElementById('event-date').value = app.getTodayDate();
        await loadRopersForSelection();

        // Reload events dropdown for modification section
        await loadEventsForModification();

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error creating event:', error);
        app.showNotification('Error creating event', 'error');
    }
}

/**
 * Display generated pairings
 * @param {number} eventId - Event ID
 * @param {Array} pairings - Array of pairings
 * @param {Array} ropers - Array of all participating ropers
 */
async function displayPairings(eventId, pairings, ropers) {
    const pairingsSection = document.getElementById('pairings-section');
    const pairingsList = document.getElementById('pairings-list');

    // Create a map for quick roper lookup
    const roperMap = {};
    ropers.forEach(r => roperMap[r.id] = r);

    pairingsList.innerHTML = pairings.map((pairing, index) => {
        const header = roperMap[pairing.headerId];
        const heeler = roperMap[pairing.heelerId];

        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-4">
                    <span class="text-lg font-bold text-gray-400">#${index + 1}</span>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold">${header ? header.name : 'Unknown'}</span>
                            <span class="text-gray-400">&</span>
                            <span class="font-semibold">${heeler ? heeler.name : 'Unknown'}</span>
                        </div>
                        <div class="text-xs text-gray-600 mt-1">
                            <span class="text-blue-600">Header</span> &
                            <span class="text-green-600">Heeler</span>
                        </div>
                    </div>
                </div>
                <div class="text-sm text-gray-500">
                    Round ${pairing.round}
                </div>
            </div>
        `;
    }).join('');

    pairingsSection.classList.remove('hidden');

    // Scroll to pairings
    setTimeout(() => {
        pairingsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

/**
 * Load events for modification dropdown
 */
async function loadEventsForModification() {
    try {
        const events = await dbHelpers.getAllEvents();
        const select = document.getElementById('modify-event-select');

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
        console.error('Error loading events for modification:', error);
    }
}

/**
 * Handle modify event selection change
 */
async function handleModifyEventChange(e) {
    const eventId = parseInt(e.target.value);

    if (!eventId) {
        document.getElementById('modify-event-section').classList.add('hidden');
        currentModifyEventId = null;
        return;
    }

    currentModifyEventId = eventId;
    await loadEventForModification(eventId);
}

/**
 * Load event data for modification
 */
async function loadEventForModification(eventId) {
    try {
        const event = await dbHelpers.getEvent(eventId);
        if (!event) return;

        const isCompleted = event.status === 'completed';

        // Display event info
        document.getElementById('modify-event-name').textContent = event.name;
        document.getElementById('modify-event-date').textContent = `Date: ${app.formatDate(event.date)}`;

        // Update status badge
        const statusBadge = document.getElementById('modify-event-status-badge');
        const toggleBtn = document.getElementById('toggle-event-status-btn');

        if (isCompleted) {
            statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm bg-green-100 text-green-800';
            statusBadge.textContent = 'Completed';
            toggleBtn.textContent = 'Mark as Active';
            toggleBtn.className = 'text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700';
        } else {
            statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800';
            statusBadge.textContent = 'Active';
            toggleBtn.textContent = 'Mark as Completed';
            toggleBtn.className = 'text-sm px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700';
        }

        // Show/hide modification controls based on completion status
        const modificationControls = document.getElementById('event-modification-controls');
        const editButtons = document.getElementById('event-edit-buttons');
        const editWarning = document.getElementById('event-edit-warning');
        const completedMessage = document.getElementById('event-completed-message');

        if (isCompleted) {
            modificationControls.classList.add('hidden');
            editButtons.classList.add('hidden');
            editWarning.classList.add('hidden');
            completedMessage.classList.remove('hidden');
        } else {
            modificationControls.classList.remove('hidden');
            editButtons.classList.remove('hidden');
            editWarning.classList.remove('hidden');
            completedMessage.classList.add('hidden');
        }

        // Load all ropers
        const allRopers = await dbHelpers.getAllRopers();

        // Filter and sort headers and heelers
        const headers = allRopers.filter(r => r.position === 'header');
        const heelers = allRopers.filter(r => r.position === 'heeler');

        headers.sort((a, b) => a.name.localeCompare(b.name));
        heelers.sort((a, b) => a.name.localeCompare(b.name));

        const headersContainer = document.getElementById('modify-headers-selection');
        const heelersContainer = document.getElementById('modify-heelers-selection');

        // Populate headers
        if (headers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No headers available</p>';
        } else {
            headersContainer.innerHTML = headers.map(roper => {
                const isChecked = event.roperIds.includes(roper.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-blue-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="modify-roper" value="${roper.id}" ${isChecked}
                               class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                        <span class="flex-grow text-sm">
                            ${roper.name}
                        </span>
                    </label>
                `;
            }).join('');
        }

        // Populate heelers
        if (heelers.length === 0) {
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No heelers available</p>';
        } else {
            heelersContainer.innerHTML = heelers.map(roper => {
                const isChecked = event.roperIds.includes(roper.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-green-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="modify-roper" value="${roper.id}" ${isChecked}
                               class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500">
                        <span class="flex-grow text-sm">
                            ${roper.name}
                        </span>
                    </label>
                `;
            }).join('');
        }

        // Show modification section
        document.getElementById('modify-event-section').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading event for modification:', error);
        app.showNotification('Error loading event', 'error');
    }
}

/**
 * Update event ropers and regenerate pairings
 */
async function updateEventRopers() {
    if (!currentModifyEventId) return;

    try {
        // Check if event is completed
        const event = await dbHelpers.getEvent(currentModifyEventId);
        if (event && event.status === 'completed') {
            app.showNotification('Cannot modify a completed event. Mark it as active first.', 'error');
            return;
        }

        // Confirm action
        const confirmed = await app.confirm(
            'This will regenerate all pairings and delete any recorded times for this event. Continue?'
        );
        if (!confirmed) return;

        // Get selected ropers
        const selectedRopers = Array.from(document.querySelectorAll('input[name="modify-roper"]:checked'))
            .map(cb => parseInt(cb.value));

        if (selectedRopers.length < 2) {
            app.showNotification('Please select at least 2 ropers', 'error');
            return;
        }

        // Get full roper objects
        const allRopers = await dbHelpers.getAllRopers();
        const participatingRopers = allRopers.filter(r => selectedRopers.includes(r.id));

        // Separate headers and heelers
        const headers = participatingRopers.filter(r => r.position === 'header');
        const heelers = participatingRopers.filter(r => r.position === 'heeler');

        if (headers.length === 0 || heelers.length === 0) {
            app.showNotification('You need at least one header and one heeler', 'error');
            return;
        }

        // Generate new pairings
        const pairings = app.generateRoundRobinPairings(headers, heelers);

        if (pairings.length === 0) {
            app.showNotification('Could not generate pairings', 'error');
            return;
        }

        // Delete all old runs for this event
        await db.runs.where('eventId').equals(currentModifyEventId).delete();

        // Update event with new ropers and pairings
        await dbHelpers.updateEvent(currentModifyEventId, {
            roperIds: selectedRopers,
            pairings: pairings
        });

        // Create new run records
        const runs = pairings.map(pairing => ({
            eventId: currentModifyEventId,
            headerId: pairing.headerId,
            heelerId: pairing.heelerId,
            round: pairing.round,
            time: null,
            completed: false
        }));

        await db.runs.bulkAdd(runs);

        app.showNotification(`Event updated with ${pairings.length} new teams!`, 'success');

        // Reset and reload
        cancelModifyEvent();
        await loadEventsForModification();

        // Update stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error updating event:', error);
        app.showNotification('Error updating event', 'error');
    }
}

/**
 * Cancel event modification
 */
function cancelModifyEvent() {
    document.getElementById('modify-event-section').classList.add('hidden');
    document.getElementById('modify-event-select').value = '';
    currentModifyEventId = null;
}

/**
 * Toggle event status between active and completed
 */
async function toggleEventStatus() {
    if (!currentModifyEventId) return;

    try {
        const event = await dbHelpers.getEvent(currentModifyEventId);
        if (!event) return;

        const newStatus = event.status === 'completed' ? 'active' : 'completed';
        const statusText = newStatus === 'completed' ? 'completed' : 'active';

        const confirmed = await app.confirm(
            `Mark this event as ${statusText}?`,
            `${newStatus === 'completed' ? 'Complete Event' : 'Reactivate Event'}`
        );

        if (!confirmed) return;

        await dbHelpers.updateEvent(currentModifyEventId, { status: newStatus });

        app.showNotification(`Event marked as ${statusText}!`, 'success');

        // Reload the event display
        await loadEventForModification(currentModifyEventId);

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error toggling event status:', error);
        app.showNotification('Error updating event status', 'error');
    }
}

// Set up form submission handler
document.getElementById('create-event-form').addEventListener('submit', handleCreateEvent);

// Set up modify event dropdown handler
document.getElementById('modify-event-select').addEventListener('change', handleModifyEventChange);

// Export functions to global scope
window.updateEventRopers = updateEventRopers;
window.cancelModifyEvent = cancelModifyEvent;
window.toggleEventStatus = toggleEventStatus;

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'events') {
        loadEventsPage();
    }
});

console.log('Events page script loaded');
