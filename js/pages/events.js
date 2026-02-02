/**
 * Create Event Page JavaScript
 * Handles event creation and pairing generation
 */

// Store current event being modified
let currentModifyEventId = null;

// Store last created event ID for Begin Event button
let lastCreatedEventId = null;

// Persistent storage for selected ropers (survives filtering/searching)
let persistentSelectedRopers = [];

/**
 * Load the events page
 */
async function loadEventsPage() {
    try {
        // Reset page state
        currentModifyEventId = null;
        lastCreatedEventId = null;
        persistentSelectedRopers = []; // Clear selections when loading page

        // Reset and hide the create event form sections
        document.getElementById('create-event-form').reset();
        document.getElementById('pairings-section').classList.add('hidden');

        // Reset and hide the modify event section
        document.getElementById('modify-event-select').value = '';
        document.getElementById('modify-event-section').classList.add('hidden');

        // Clear search fields
        const headerSearch = document.getElementById('event-headers-search');
        const heelerSearch = document.getElementById('event-heelers-search');
        if (headerSearch) headerSearch.value = '';
        if (heelerSearch) heelerSearch.value = '';

        await loadRopersForSelection();
        await loadEventsForModification();

        // Set default date to today
        document.getElementById('event-date').value = app.getTodayDate();

        // Initialize payout fields based on default placesToPay
        generatePayoutFields();
    } catch (error) {
        console.error('Error loading events page:', error);
        app.showNotification('Error loading page', 'error');
    }
}

/**
 * Load ropers for selection checkboxes
 * Separates headers and heelers into different sections
 * @param {string} headerSearch - Search term for headers
 * @param {string} heelerSearch - Search term for heelers
 */
async function loadRopersForSelection(headerSearch = '', heelerSearch = '') {
    try {
        // Update persistent storage with currently checked ropers (before rebuilding)
        const currentlyChecked = Array.from(document.querySelectorAll('input[name="event-roper"]:checked'))
            .map(cb => parseInt(cb.value));

        // Merge with persistent storage (add new, keep old)
        currentlyChecked.forEach(id => {
            if (!persistentSelectedRopers.includes(id)) {
                persistentSelectedRopers.push(id);
            }
        });

        const ropers = await dbHelpers.getAllRopers();
        const headersContainer = document.getElementById('event-headers-selection');
        const heelersContainer = document.getElementById('event-heelers-selection');

        if (ropers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Add ropers first in Manage Ropers page</p>';
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Add ropers first in Manage Ropers page</p>';
            return;
        }

        // Filter headers (position = 'header' only)
        let headers = ropers.filter(r => r.position === 'header');
        if (headerSearch) {
            headers = headers.filter(r => r.name.toLowerCase().includes(headerSearch.toLowerCase()));
        }

        // Filter heelers (position = 'heeler' only)
        let heelers = ropers.filter(r => r.position === 'heeler');
        if (heelerSearch) {
            heelers = heelers.filter(r => r.name.toLowerCase().includes(heelerSearch.toLowerCase()));
        }

        // Sort headers and heelers alphabetically by name
        headers.sort((a, b) => a.name.localeCompare(b.name));
        heelers.sort((a, b) => a.name.localeCompare(b.name));

        // Populate headers section
        if (headers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No headers available</p>';
        } else {
            headersContainer.innerHTML = `
                <label class="flex items-center gap-2 p-2 rounded bg-blue-100 cursor-pointer transition-colors font-semibold mb-2">
                    <input type="checkbox" id="select-all-headers"
                           onchange="toggleSelectAll('headers')"
                           class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                    <span class="flex-grow text-sm">
                        Select All Headers
                    </span>
                </label>
            ` + headers.map(roper => {
                // Check if this roper is in persistent selections
                const isChecked = persistentSelectedRopers.includes(roper.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-blue-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="event-roper" value="${roper.id}" data-position="header"
                               class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 event-header-checkbox" ${isChecked}>
                        <span class="flex-grow text-sm">
                            ${roper.name}
                        </span>
                    </label>
                `;
            }).join('');
        }

        // Populate heelers section
        if (heelers.length === 0) {
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No heelers available</p>';
        } else {
            heelersContainer.innerHTML = `
                <label class="flex items-center gap-2 p-2 rounded bg-green-100 cursor-pointer transition-colors font-semibold mb-2">
                    <input type="checkbox" id="select-all-heelers"
                           onchange="toggleSelectAll('heelers')"
                           class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500">
                    <span class="flex-grow text-sm">
                        Select All Heelers
                    </span>
                </label>
            ` + heelers.map(roper => {
                // Check if this roper is in persistent selections
                const isChecked = persistentSelectedRopers.includes(roper.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-green-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="event-roper" value="${roper.id}" data-position="heeler"
                               class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 event-heeler-checkbox" ${isChecked}>
                        <span class="flex-grow text-sm">
                            ${roper.name}
                        </span>
                    </label>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading ropers for selection:', error);
    }

    // Add event listeners to update counters AND persistent storage when checkboxes change
    updateRoperCounts();
    document.querySelectorAll('.event-header-checkbox, .event-heeler-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const roperId = parseInt(e.target.value);
            if (e.target.checked) {
                // Add to persistent selections
                if (!persistentSelectedRopers.includes(roperId)) {
                    persistentSelectedRopers.push(roperId);
                }
            } else {
                // Remove from persistent selections
                persistentSelectedRopers = persistentSelectedRopers.filter(id => id !== roperId);
            }
            updateRoperCounts();
            calculateEventMoney(); // Recalculate money when ropers change
        });
    });
}

/**
 * Update the counter badges showing how many ropers are selected
 */
function updateRoperCounts() {
    // Count selected headers
    const selectedHeaders = document.querySelectorAll('.event-header-checkbox:checked').length;
    const headerCountElement = document.getElementById('header-count');
    if (headerCountElement) {
        headerCountElement.textContent = `${selectedHeaders} selected`;
    }

    // Count selected heelers
    const selectedHeelers = document.querySelectorAll('.event-heeler-checkbox:checked').length;
    const heelerCountElement = document.getElementById('heeler-count');
    if (heelerCountElement) {
        heelerCountElement.textContent = `${selectedHeelers} selected`;
    }
}

/**
 * Update the counter badges for modify event section
 */
function updateModifyRoperCounts() {
    // Count selected headers in modify section
    const selectedHeaders = document.querySelectorAll('#modify-headers-selection input[type="checkbox"]:checked:not(#modify-select-all-headers)').length;
    const headerCountElement = document.getElementById('modify-header-count');
    if (headerCountElement) {
        headerCountElement.textContent = `${selectedHeaders} selected`;
    }

    // Count selected heelers in modify section
    const selectedHeelers = document.querySelectorAll('#modify-heelers-selection input[type="checkbox"]:checked:not(#modify-select-all-heelers)').length;
    const heelerCountElement = document.getElementById('modify-heeler-count');
    if (heelerCountElement) {
        heelerCountElement.textContent = `${selectedHeelers} selected`;
    }
}

/**
 * Validate and highlight all invalid fields in a form
 * @param {HTMLFormElement} form - The form to validate
 * @returns {boolean} - True if form is valid, false otherwise
 */
function validateFormFields(form) {
    // Remove any existing invalid-field classes
    form.querySelectorAll('.invalid-field').forEach(field => {
        field.classList.remove('invalid-field');
    });

    // Check form validity
    if (form.checkValidity()) {
        return true;
    }

    // Find all invalid fields and mark them
    const invalidFields = form.querySelectorAll(':invalid');
    invalidFields.forEach(field => {
        field.classList.add('invalid-field');
    });

    // Scroll to first invalid field
    if (invalidFields.length > 0) {
        invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        invalidFields[0].focus();
    }

    return false;
}

/**
 * Handle create event form submission
 */
async function handleCreateEvent(e) {
    e.preventDefault();

    // Validate all form fields
    const form = e.target;
    if (!validateFormFields(form)) {
        app.showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const eventName = document.getElementById('event-name').value.trim();
        const eventDate = document.getElementById('event-date').value;
        const placesToPayInput = document.getElementById('event-places-to-pay').value;
        const placesToPay = placesToPayInput ? parseInt(placesToPayInput) : null;

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

        // Collect penalties
        const penalties = getPenalties();

        // Collect money management data
        const entryFee = parseFloat(document.getElementById('event-entry-fee').value) || null;
        const stockFeePercent = parseFloat(document.getElementById('event-stock-fee-percent').value) || null;
        const payouts = getPayouts();

        // Create event
        const eventId = await dbHelpers.createEvent({
            name: eventName,
            date: eventDate,
            roperIds: selectedRopers,
            pairings: pairings,
            penalties: penalties,
            placesToPay: placesToPay,
            entryFee: entryFee,
            stockFeePercent: stockFeePercent,
            payouts: payouts
        });

        // Store the event ID for Begin Event button
        lastCreatedEventId = eventId;

        app.showNotification(`Event "${eventName}" created with ${pairings.length} teams!`, 'success');

        // Display the pairings
        await displayPairings(eventId, pairings, participatingRopers);

        // Reset form
        e.target.reset();
        document.getElementById('event-date').value = app.getTodayDate();
        persistentSelectedRopers = []; // Clear persistent selections after successful create
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

    // Get all ropers including deleted ones to show proper names
    const allRopers = await dbHelpers.getAllRopersIncludingDeleted();
    const roperMap = {};
    allRopers.forEach(r => roperMap[r.id] = r);

    pairingsList.innerHTML = pairings.map((pairing, index) => {
        const header = roperMap[pairing.headerId];
        const heeler = roperMap[pairing.heelerId];

        const headerName = header ? (header.deleted ? `${header.name} <span class="text-gray-400 text-xs">(Deleted)</span>` : header.name) : 'Unknown';
        const heelerName = heeler ? (heeler.deleted ? `${heeler.name} <span class="text-gray-400 text-xs">(Deleted)</span>` : heeler.name) : 'Unknown';

        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-4">
                    <span class="text-lg font-bold text-gray-400">#${index + 1}</span>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold">${headerName}</span>
                            <span class="text-gray-400">&</span>
                            <span class="font-semibold">${heelerName}</span>
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
        const allEvents = await dbHelpers.getAllEvents();
        const select = document.getElementById('modify-event-select');

        select.innerHTML = '<option value="">Choose an event...</option>';

        // Split into active and completed events
        const activeEvents = allEvents.filter(event => event.status !== 'completed');
        const completedEvents = allEvents.filter(event => event.status === 'completed');

        // Add active events section
        if (activeEvents.length > 0) {
            const activeOptgroup = document.createElement('optgroup');
            activeOptgroup.label = '── Active Events ──';

            activeEvents.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = `${event.name} - ${app.formatDate(event.date)}`;
                activeOptgroup.appendChild(option);
            });

            select.appendChild(activeOptgroup);
        }

        // Add completed events section
        if (completedEvents.length > 0) {
            const completedOptgroup = document.createElement('optgroup');
            completedOptgroup.label = '── Completed Events ──';

            completedEvents.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = `${event.name} - ${app.formatDate(event.date)}`;
                completedOptgroup.appendChild(option);
            });

            select.appendChild(completedOptgroup);
        }

        // If no events at all
        if (activeEvents.length === 0 && completedEvents.length === 0) {
            select.innerHTML += '<option value="" disabled>No events available</option>';
        }
    } catch (error) {
        console.error('Error loading events for modification:', error);
    }
}

/**
 * Handle modify event selection change
 */
async function handleModifyEventChange(e) {
    const eventId = parseInt(e.target.value);

    // Show/hide the View Participants button
    const viewParticipantsBtn = document.getElementById('view-participants-btn');
    if (!eventId) {
        document.getElementById('modify-event-section').classList.add('hidden');
        viewParticipantsBtn.classList.add('hidden');
        currentModifyEventId = null;
        return;
    }

    viewParticipantsBtn.classList.remove('hidden');
    currentModifyEventId = eventId;
    await loadEventForModification(eventId);
}

/**
 * Load event data for modification
 */
async function loadEventForModification(eventId) {
    try {
        // Hide the created event pairings section to avoid confusion
        document.getElementById('pairings-section').classList.add('hidden');

        const event = await dbHelpers.getEvent(eventId);
        if (!event) return;

        const isCompleted = event.status === 'completed';

        // Populate event info in input fields
        document.getElementById('modify-event-name-input').value = event.name;
        document.getElementById('modify-event-date-input').value = event.date;
        document.getElementById('modify-event-places-to-pay').value = event.placesToPay || '';

        // Populate money management fields
        document.getElementById('modify-event-entry-fee').value = event.entryFee || '';
        document.getElementById('modify-event-stock-fee-percent').value = event.stockFeePercent || '';

        // Update status badge
        const statusBadge = document.getElementById('modify-event-status-badge');
        const toggleBtn = document.getElementById('toggle-event-status-btn');

        if (isCompleted) {
            statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm bg-green-100 text-green-800';
            statusBadge.textContent = 'Completed';
            toggleBtn.textContent = 'Mark as Active';
            toggleBtn.className = 'px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium';
        } else {
            statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800';
            statusBadge.textContent = 'Active';
            toggleBtn.textContent = 'Mark as Completed';
            toggleBtn.className = 'px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 text-sm font-medium';
        }

        // Show "Begin Event" button if event date is today or in the past
        const beginEventBtn = document.getElementById('begin-existing-event-btn');
        const eventDate = app.parseLocalDate(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eventDate <= today && !isCompleted) {
            beginEventBtn.classList.remove('hidden');
        } else {
            beginEventBtn.classList.add('hidden');
        }

        // Show/hide completed vs editing views
        const completedView = document.getElementById('event-completed-view');
        const editingView = document.getElementById('event-editing-view');

        if (isCompleted) {
            // Show completed view
            completedView.classList.remove('hidden');
            editingView.classList.add('hidden');

            // Populate completed view
            document.getElementById('completed-event-name').textContent = event.name;
            document.getElementById('completed-event-date').textContent = app.formatDate(event.date);
        } else {
            // Show editing view
            completedView.classList.add('hidden');
            editingView.classList.remove('hidden');
        }

        // Load all ropers including deleted ones (so they can see who was in the event and add last-minute ropers)
        const allRopers = await dbHelpers.getAllRopersIncludingDeleted();

        // Filter and sort headers and heelers
        const headers = allRopers.filter(r => r.position === 'header');
        const heelers = allRopers.filter(r => r.position === 'heeler');

        // Sort: non-deleted first, then by name
        const sortRopers = (a, b) => {
            if (a.deleted !== b.deleted) {
                return a.deleted ? 1 : -1; // Non-deleted first
            }
            return a.name.localeCompare(b.name);
        };

        headers.sort(sortRopers);
        heelers.sort(sortRopers);

        const headersContainer = document.getElementById('modify-headers-selection');
        const heelersContainer = document.getElementById('modify-heelers-selection');

        // Populate headers
        if (headers.length === 0) {
            headersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No headers available</p>';
        } else {
            headersContainer.innerHTML = `
                <label class="flex items-center gap-2 p-2 rounded bg-blue-100 cursor-pointer transition-colors font-semibold mb-2">
                    <input type="checkbox" id="modify-select-all-headers"
                           onchange="toggleModifySelectAll('headers')"
                           class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                    <span class="flex-grow text-sm">
                        Select All Headers
                    </span>
                </label>
            ` + headers.map(roper => {
                const isChecked = event.roperIds.includes(roper.id) ? 'checked' : '';
                const deletedLabel = roper.deleted ? ' <span class="text-gray-400">(Deleted)</span>' : '';
                const labelClass = roper.deleted ? 'text-gray-500' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-blue-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="modify-roper" value="${roper.id}" ${isChecked}
                               class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                        <span class="flex-grow text-sm ${labelClass}">
                            ${roper.name}${deletedLabel}
                        </span>
                    </label>
                `;
            }).join('');
        }

        // Populate heelers
        if (heelers.length === 0) {
            heelersContainer.innerHTML = '<p class="text-gray-500 italic text-sm">No heelers available</p>';
        } else {
            heelersContainer.innerHTML = `
                <label class="flex items-center gap-2 p-2 rounded bg-green-100 cursor-pointer transition-colors font-semibold mb-2">
                    <input type="checkbox" id="modify-select-all-heelers"
                           onchange="toggleModifySelectAll('heelers')"
                           class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500">
                    <span class="flex-grow text-sm">
                        Select All Heelers
                    </span>
                </label>
            ` + heelers.map(roper => {
                const isChecked = event.roperIds.includes(roper.id) ? 'checked' : '';
                const deletedLabel = roper.deleted ? ' <span class="text-gray-400">(Deleted)</span>' : '';
                const labelClass = roper.deleted ? 'text-gray-500' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded hover:bg-green-100 cursor-pointer transition-colors">
                        <input type="checkbox" name="modify-roper" value="${roper.id}" ${isChecked}
                               class="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500">
                        <span class="flex-grow text-sm ${labelClass}">
                            ${roper.name}${deletedLabel}
                        </span>
                    </label>
                `;
            }).join('');
        }

        // Populate penalties
        const modifyPenaltiesList = document.getElementById('modify-penalties-list');
        const eventPenalties = event.penalties || [
            { name: 'One Leg', seconds: 5 },
            { name: 'Barrier', seconds: 5 }
        ];

        modifyPenaltiesList.innerHTML = eventPenalties.map(penalty => {
            return `
                <div class="penalty-item flex gap-1 sm:gap-2 items-center">
                    <input type="text" class="penalty-name flex-1 px-2 sm:px-3 py-2 border rounded-lg text-sm"
                           placeholder="Penalty" value="${penalty.name}">
                    <input type="number" class="penalty-seconds w-16 sm:w-24 px-2 sm:px-3 py-2 border rounded-lg text-sm"
                           placeholder="Sec" value="${penalty.seconds}" min="0" step="0.01">
                    <button type="button" onclick="removeModifyPenalty(this)"
                            class="px-1 sm:px-2 py-2 text-red-600 hover:text-red-800 flex-shrink-0">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Generate payout fields based on placesToPay
        generateModifyPayoutFields();

        // Populate payout amounts from event data
        if (event.payouts && event.payouts.length > 0) {
            event.payouts.forEach(payout => {
                const headerInput = document.querySelector(`.modify-payout-field-header[data-place="${payout.place}"]`);
                const heelerInput = document.querySelector(`.modify-payout-field-heeler[data-place="${payout.place}"]`);
                if (headerInput) headerInput.value = payout.headerAmount || '';
                if (heelerInput) heelerInput.value = payout.heelerAmount || '';
            });
        }

        // Initial calculation
        calculateModifyEventMoney();

        // Add event listeners to update counters for modify section
        updateModifyRoperCounts();
        document.querySelectorAll('#modify-headers-selection input[type="checkbox"], #modify-heelers-selection input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                updateModifyRoperCounts();
                calculateModifyEventMoney(); // Recalculate when ropers change
            });
        });

        // Show modification section
        document.getElementById('modify-event-section').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading event for modification:', error);
        app.showNotification('Error loading event', 'error');
    }
}

/**
 * Update event - handles name, date, penalties, and ropers
 */
async function updateEvent() {
    if (!currentModifyEventId) return;

    // Validate all money management fields
    const entryFeeField = document.getElementById('modify-event-entry-fee');
    const stockFeeField = document.getElementById('modify-event-stock-fee-percent');
    const payoutFields = document.querySelectorAll('.modify-payout-field-header, .modify-payout-field-heeler');

    // Clear previous invalid states
    [entryFeeField, stockFeeField, ...payoutFields].forEach(field => {
        if (field) field.classList.remove('invalid-field');
    });

    // Check for invalid fields
    const invalidFields = [];
    if (!entryFeeField.value || entryFeeField.value <= 0) {
        entryFeeField.classList.add('invalid-field');
        invalidFields.push(entryFeeField);
    }
    if (stockFeeField.value === '' || stockFeeField.value < 0) {
        stockFeeField.classList.add('invalid-field');
        invalidFields.push(stockFeeField);
    }
    payoutFields.forEach(field => {
        if (!field.value || field.value < 0) {
            field.classList.add('invalid-field');
            invalidFields.push(field);
        }
    });

    if (invalidFields.length > 0) {
        app.showNotification('Please fill in all required money management fields', 'error');
        invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        invalidFields[0].focus();
        return;
    }

    try {
        // Check if event is completed
        const event = await dbHelpers.getEvent(currentModifyEventId);
        if (event && event.status === 'completed') {
            app.showNotification('Cannot modify a completed event. Mark it as active first.', 'error');
            return;
        }

        // Get updated values
        const newName = document.getElementById('modify-event-name-input').value.trim();
        const newDate = document.getElementById('modify-event-date-input').value;
        const placesToPayInput = document.getElementById('modify-event-places-to-pay').value;
        const placesToPay = placesToPayInput ? parseInt(placesToPayInput) : null;
        const penalties = getModifyPenalties();

        // Get money management data
        const entryFee = parseFloat(document.getElementById('modify-event-entry-fee').value) || null;
        const stockFeePercent = parseFloat(document.getElementById('modify-event-stock-fee-percent').value) || null;
        const payouts = getModifyPayouts();

        // Get selected ropers
        const selectedRopers = Array.from(document.querySelectorAll('input[name="modify-roper"]:checked'))
            .map(cb => parseInt(cb.value));

        // Validation
        if (!newName) {
            app.showNotification('Please enter an event name', 'error');
            return;
        }

        if (!newDate) {
            app.showNotification('Please select an event date', 'error');
            return;
        }

        if (selectedRopers.length < 2) {
            app.showNotification('Please select at least 2 ropers', 'error');
            return;
        }

        // Check if ropers or penalties have changed
        const ropersChanged = JSON.stringify(event.roperIds.sort()) !== JSON.stringify(selectedRopers.sort());
        const penaltiesChanged = JSON.stringify(event.penalties || []) !== JSON.stringify(penalties);

        if (ropersChanged || penaltiesChanged) {
            // If ropers or penalties changed, warn and regenerate teams
            let warningMessage = '';
            if (ropersChanged && penaltiesChanged) {
                warningMessage = 'Changing ropers and penalties will regenerate all teams and delete any recorded times for this event. Continue?';
            } else if (ropersChanged) {
                warningMessage = 'Changing ropers will regenerate all teams and delete any recorded times for this event. Continue?';
            } else {
                warningMessage = 'Changing penalties will delete any recorded times for this event because penalty changes affect scoring. Continue?';
            }

            const confirmed = await app.confirm(warningMessage);
            if (!confirmed) return;

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

            // Update event with everything including new pairings
            await dbHelpers.updateEvent(currentModifyEventId, {
                name: newName,
                date: newDate,
                roperIds: selectedRopers,
                pairings: pairings,
                penalties: penalties,
                placesToPay: placesToPay,
                entryFee: entryFee,
                stockFeePercent: stockFeePercent,
                payouts: payouts
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
        } else if (penaltiesChanged) {
            // Penalties changed but ropers didn't - delete times but keep teams
            // Get all runs for this event and reset their times
            const existingRuns = await db.runs.where('eventId').equals(currentModifyEventId).toArray();

            // Reset all run times
            for (const run of existingRuns) {
                await db.runs.update(run.id, {
                    time: null,
                    rawTime: null,
                    penalties: [],
                    completed: false,
                    recordedAt: null
                });
            }

            // Update event with new penalties
            await dbHelpers.updateEvent(currentModifyEventId, {
                name: newName,
                date: newDate,
                penalties: penalties,
                placesToPay: placesToPay,
                entryFee: entryFee,
                stockFeePercent: stockFeePercent,
                payouts: payouts
            });

            app.showNotification('Event updated! All recorded times have been cleared due to penalty changes.', 'success');
        } else {
            // Just update name, date, placesToPay, and money fields without affecting teams or times
            await dbHelpers.updateEvent(currentModifyEventId, {
                name: newName,
                date: newDate,
                placesToPay: placesToPay,
                entryFee: entryFee,
                stockFeePercent: stockFeePercent,
                payouts: payouts
            });

            app.showNotification('Event updated successfully!', 'success');
        }

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

        // Get penalties
        const penalties = getModifyPenalties();

        // Delete all old runs for this event
        await db.runs.where('eventId').equals(currentModifyEventId).delete();

        // Update event with new ropers, pairings, and penalties
        await dbHelpers.updateEvent(currentModifyEventId, {
            roperIds: selectedRopers,
            pairings: pairings,
            penalties: penalties
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

// Set up search handlers for modify event page
document.getElementById('modify-headers-search').addEventListener('input', filterModifyRopers);
document.getElementById('modify-heelers-search').addEventListener('input', filterModifyRopers);

// Set up search handlers for create event page
document.getElementById('event-headers-search').addEventListener('input', (e) => {
    const heelerSearch = document.getElementById('event-heelers-search').value;
    loadRopersForSelection(e.target.value, heelerSearch);
});

document.getElementById('event-heelers-search').addEventListener('input', (e) => {
    const headerSearch = document.getElementById('event-headers-search').value;
    loadRopersForSelection(headerSearch, e.target.value);
});

// Set up validation for event name and date inputs
// Event listeners for form inputs (validation removed)

// ====================PENALTY MANAGEMENT ====================

/**
 * Add a new penalty row
 */
function addPenalty() {
    const penaltiesList = document.getElementById('penalties-list');
    const penaltyItem = document.createElement('div');
    penaltyItem.className = 'penalty-item flex gap-2 items-center';
    penaltyItem.innerHTML = `
        <input type="text" class="penalty-name flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Penalty name">
        <input type="number" class="penalty-seconds w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Seconds" value="5" min="0" step="0.01">
        <button type="button" onclick="removePenalty(this)" class="px-2 py-2 text-red-600 hover:text-red-800">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
        </button>
    `;
    penaltiesList.appendChild(penaltyItem);
}

/**
 * Remove a penalty row
 * @param {HTMLElement} button - The remove button clicked
 */
function removePenalty(button) {
    button.closest('.penalty-item').remove();
}

/**
 * Get all penalties from the form
 * @returns {Array} - Array of penalty objects {name, seconds}
 */
function getPenalties() {
    const penaltyItems = document.querySelectorAll('.penalty-item');
    const penalties = [];

    penaltyItems.forEach(item => {
        const name = item.querySelector('.penalty-name').value.trim();
        const seconds = parseFloat(item.querySelector('.penalty-seconds').value) || 0;

        if (name && seconds > 0) {
            penalties.push({ name, seconds });
        }
    });

    return penalties;
}

/**
 * Add a new penalty row to the modify penalties list
 */
function addModifyPenalty() {
    const penaltiesList = document.getElementById('modify-penalties-list');
    const penaltyItem = document.createElement('div');
    penaltyItem.className = 'penalty-item flex gap-1 sm:gap-2 items-center';
    penaltyItem.innerHTML = `
        <input type="text" class="penalty-name flex-1 px-2 sm:px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Penalty">
        <input type="number" class="penalty-seconds w-16 sm:w-24 px-2 sm:px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Sec" value="5" min="0" step="0.01">
        <button type="button" onclick="removeModifyPenalty(this)" class="px-1 sm:px-2 py-2 text-red-600 hover:text-red-800 flex-shrink-0">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
        </button>
    `;
    penaltiesList.appendChild(penaltyItem);
}

/**
 * Remove a penalty row from the modify penalties list
 * @param {HTMLElement} button - The remove button clicked
 */
function removeModifyPenalty(button) {
    button.closest('.penalty-item').remove();
}

/**
 * Get all penalties from the modify penalties list
 * @returns {Array} - Array of penalty objects {name, seconds}
 */
function getModifyPenalties() {
    const penaltyItems = document.querySelectorAll('#modify-penalties-list .penalty-item');
    const penalties = [];

    penaltyItems.forEach(item => {
        const name = item.querySelector('.penalty-name').value.trim();
        const seconds = parseFloat(item.querySelector('.penalty-seconds').value) || 0;

        if (name && seconds > 0) {
            penalties.push({ name, seconds });
        }
    });

    return penalties;
}

/**
 * Toggle select all for modify event headers or heelers
 * @param {string} position - 'headers' or 'heelers'
 */
function toggleModifySelectAll(position) {
    const selectAllId = position === 'headers' ? 'modify-select-all-headers' : 'modify-select-all-heelers';
    const selectAllCheckbox = document.getElementById(selectAllId);
    const checkboxes = document.querySelectorAll(`#modify-${position}-selection input[type="checkbox"]:not([disabled])`);

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });

    // Update counters after toggling all
    updateModifyRoperCounts();
}

/**
 * Filter ropers in the modify event form based on search input
 */
function filterModifyRopers() {
    const headerSearch = document.getElementById('modify-headers-search').value.toLowerCase();
    const heelerSearch = document.getElementById('modify-heelers-search').value.toLowerCase();

    // Filter headers
    const headerLabels = document.querySelectorAll('#modify-headers-selection label');
    headerLabels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(headerSearch)) {
            label.style.display = '';
        } else {
            label.style.display = 'none';
        }
    });

    // Filter heelers
    const heelerLabels = document.querySelectorAll('#modify-heelers-selection label');
    heelerLabels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(heelerSearch)) {
            label.style.display = '';
        } else {
            label.style.display = 'none';
        }
    });
}

// Export functions to global scope
/**
 * Toggle select all for headers or heelers
 * @param {string} position - 'headers' or 'heelers'
 */
function toggleSelectAll(position) {
    const selectAllId = position === 'headers' ? 'select-all-headers' : 'select-all-heelers';
    const checkboxClass = position === 'headers' ? '.event-header-checkbox' : '.event-heeler-checkbox';

    const selectAllCheckbox = document.getElementById(selectAllId);
    const checkboxes = document.querySelectorAll(checkboxClass);

    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });

    // Update counters after toggling all
    updateRoperCounts();
}


/**
 * Begin Event - Navigate to Record Times with event pre-selected
 */
function beginEvent() {
    if (!lastCreatedEventId) {
        app.showNotification('No event selected', 'error');
        return;
    }

    // Navigate to record times page
    router.navigate('record');

    // Wait for page to load, then select the event
    setTimeout(() => {
        const selectElement = document.getElementById('record-event-select');
        if (selectElement) {
            selectElement.value = lastCreatedEventId;
            // Trigger change event to load the teams
            selectElement.dispatchEvent(new Event('change'));
        }
    }, 100);
}

/**
 * Navigate to Record Times page with current modified event
 */
function beginExistingEvent() {
    if (!currentModifyEventId) {
        app.showNotification('Please select an event first', 'error');
        return;
    }

    // Navigate to record times page
    router.navigate('record');

    // Wait for page to load, then select the event
    setTimeout(() => {
        const selectElement = document.getElementById('record-event-select');
        if (selectElement) {
            selectElement.value = currentModifyEventId;
            // Trigger change event to load the teams
            selectElement.dispatchEvent(new Event('change'));
        }
    }, 100);
}

/**
 * Show the edit date form
 */
function editEventDate() {
    if (!currentModifyEventId) return;

    const editDateForm = document.getElementById('edit-date-form');
    const editDateBtn = document.getElementById('edit-date-btn');
    const newEventDateInput = document.getElementById('new-event-date');

    // Get current event to populate the date
    dbHelpers.getEvent(currentModifyEventId).then(event => {
        if (event) {
            newEventDateInput.value = event.date;
            editDateForm.classList.remove('hidden');
            editDateBtn.classList.add('hidden');
        }
    });
}

/**
 * Cancel editing the date
 */
function cancelEditDate() {
    const editDateForm = document.getElementById('edit-date-form');
    const editDateBtn = document.getElementById('edit-date-btn');

    editDateForm.classList.add('hidden');
    editDateBtn.classList.remove('hidden');
}

/**
 * Save the new event date
 */
async function saveEventDate() {
    if (!currentModifyEventId) return;

    const newEventDateInput = document.getElementById('new-event-date');
    const newDate = newEventDateInput.value;

    if (!newDate) {
        app.showNotification('Please select a date', 'error');
        return;
    }

    try {
        await dbHelpers.updateEvent(currentModifyEventId, { date: newDate });

        app.showNotification('Event date updated!', 'success');

        // Hide the form and show the button again
        cancelEditDate();

        // Reload the event display to show new date
        await loadEventForModification(currentModifyEventId);
    } catch (error) {
        console.error('Error updating event date:', error);
        app.showNotification('Error updating date', 'error');
    }
}

window.updateEvent = updateEvent;
window.updateEventRopers = updateEventRopers;
window.cancelModifyEvent = cancelModifyEvent;
window.toggleEventStatus = toggleEventStatus;
window.toggleSelectAll = toggleSelectAll;
window.toggleModifySelectAll = toggleModifySelectAll;
window.beginEvent = beginEvent;
window.beginExistingEvent = beginExistingEvent;
window.editEventDate = editEventDate;
window.cancelEditDate = cancelEditDate;
window.saveEventDate = saveEventDate;
window.addPenalty = addPenalty;
window.removePenalty = removePenalty;
window.addModifyPenalty = addModifyPenalty;
window.removeModifyPenalty = removeModifyPenalty;

// ====================ADD ROPER MODAL ====================

let pendingRoperPosition = null; // Track which position button was clicked
let pendingRoperContext = 'create'; // Track if modal opened from 'create' or 'modify' context

/**
 * Open the Add Roper modal with pre-selected position
 * @param {string} position - 'header' or 'heeler'
 * @param {string} context - 'create' or 'modify' (default: 'create')
 */
function openAddRoperModal(position, context = 'create') {
    pendingRoperPosition = position;
    pendingRoperContext = context;
    const modal = document.getElementById('add-roper-modal');
    const positionSelect = document.getElementById('modal-roper-position');
    const errorMsg = document.getElementById('modal-roper-error');

    // Set the position based on which button was clicked
    positionSelect.value = position;

    // Reset form
    document.getElementById('add-roper-modal-form').reset();
    document.getElementById('modal-roper-position').value = position;
    document.getElementById('modal-roper-skill').value = 5;
    errorMsg.classList.add('hidden');

    // Show modal
    modal.classList.remove('hidden');
}

/**
 * Close the Add Roper modal
 */
function closeAddRoperModal() {
    const modal = document.getElementById('add-roper-modal');
    modal.classList.add('hidden');
    pendingRoperPosition = null;
    pendingRoperContext = 'create';
}

/**
 * Handle Add Roper modal form submission
 */
async function handleAddRoperModalSubmit(e) {
    e.preventDefault();

    try {
        const name = document.getElementById('modal-roper-name').value.trim();
        const position = document.getElementById('modal-roper-position').value;
        const skillLevel = parseInt(document.getElementById('modal-roper-skill').value);
        const errorMsg = document.getElementById('modal-roper-error');

        if (!name || !position) {
            errorMsg.textContent = 'Please fill in all fields';
            errorMsg.classList.remove('hidden');
            return;
        }

        // Check for duplicate name in the same position
        const existingRopers = await dbHelpers.getAllRopers();
        const duplicate = existingRopers.find(r =>
            r.name.toLowerCase() === name.toLowerCase() &&
            r.position === position
        );

        if (duplicate) {
            errorMsg.textContent = `A ${position} named "${name}" already exists!`;
            errorMsg.classList.remove('hidden');
            return;
        }

        // Add roper to database
        const newRoperId = await dbHelpers.addRoper({
            name: name,
            position: position,
            skillLevel: skillLevel
        });

        app.showNotification(`${name} added successfully!`, 'success');

        // Store context and position before closing modal
        const savedContext = pendingRoperContext;
        const savedPosition = position;

        // Close modal (this resets pendingRoperContext, so we use savedContext)
        closeAddRoperModal();

        // Handle based on context (create or modify)
        if (savedContext === 'modify') {
            // If in modify context, reload BOTH the modify event AND the create event lists
            if (currentModifyEventId) {
                // Reload the modify event section
                await loadEventForModification(currentModifyEventId);

                // Also reload the create event section so new roper appears there too
                await loadRopersForSelection();

                // Wait a tick for DOM to be ready
                await new Promise(resolve => setTimeout(resolve, 100));

                // Automatically check the newly added roper in modify section ONLY
                // The selector needs to target the specific modify section containers
                const sectionId = savedPosition === 'header' ? 'modify-headers-selection' : 'modify-heelers-selection';
                const checkbox = document.querySelector(`#${sectionId} input[type="checkbox"][value="${newRoperId}"]`);

                if (checkbox) {
                    checkbox.checked = true;
                    checkbox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    updateModifyRoperCounts();
                } else {
                    console.log('Checkbox not found for new roper in modify section:', newRoperId, savedPosition, sectionId);
                    console.log('All checkboxes in section:', document.querySelectorAll(`#${sectionId} input[type="checkbox"]`));
                }
            }
        } else {
            // Default create context
            // Reload BOTH the create event AND the modify event lists

            // Reload the create event section
            await loadRopersForSelection();

            // Also reload the modify event section if an event is currently being edited
            if (currentModifyEventId) {
                await loadEventForModification(currentModifyEventId);
            }

            // Wait a tick for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Automatically check the newly added roper in create section ONLY
            const checkbox = document.querySelector(`input[name="event-roper"][value="${newRoperId}"]`);
            if (checkbox) {
                checkbox.checked = true;
                // Scroll to show the new roper
                checkbox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                // Update the counters
                updateRoperCounts();
            }
        }

        // Update home page stats
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } catch (error) {
        console.error('Error adding roper from modal:', error);
        const errorMsg = document.getElementById('modal-roper-error');
        errorMsg.textContent = 'Error adding roper. Please try again.';
        errorMsg.classList.remove('hidden');
    }
}

// Set up Add Roper modal form handler
document.getElementById('add-roper-modal-form').addEventListener('submit', handleAddRoperModalSubmit);

// Export functions
window.openAddRoperModal = openAddRoperModal;
window.closeAddRoperModal = closeAddRoperModal;

// ==================== MONEY MANAGEMENT ====================

/**
 * Generate payout fields based on placesToPay value
 */
function generatePayoutFields() {
    const placesToPay = parseInt(document.getElementById('event-places-to-pay').value) || 0;
    const payoutFieldsContainer = document.getElementById('event-payout-fields');

    if (placesToPay === 0) {
        payoutFieldsContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Enter "Places to Pay" above to configure payouts</p>';
        calculateEventMoney();
        return;
    }

    let html = '<div class="space-y-3">';

    // Add payout type toggle at the top
    html += `
        <div class="flex items-center justify-between mb-3">
            <label class="block text-sm font-medium">Payout Amounts by Place</label>
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600">Payout Type:</span>
                <div class="relative inline-flex items-center">
                    <input type="checkbox" id="event-payout-type-toggle" class="hidden" onchange="togglePayoutType('event')">
                    <label for="event-payout-type-toggle" class="cursor-pointer inline-flex items-center">
                        <div id="event-payout-toggle-bg" class="w-14 h-7 bg-green-600 rounded-full relative transition-colors">
                            <span class="absolute right-1.5 top-1 text-xs font-bold text-white pointer-events-none">%</span>
                            <span class="absolute left-1.5 top-1 text-xs font-bold text-white pointer-events-none">$</span>
                            <div id="event-payout-toggle-slider" class="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform"></div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    `;

    for (let place = 1; place <= placesToPay; place++) {
        const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center p-2 bg-white rounded border border-green-200">
                <div class="font-semibold text-sm text-gray-700">${placeLabel} Place:</div>
                <div>
                    <label class="block text-xs text-gray-600 mb-1">Header</label>
                    <input type="number" class="payout-field-header w-full pl-2 pr-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-green-500"
                           data-place="${place}" min="0" step="0.01" placeholder="0" oninput="calculateEventMoney()">
                </div>
                <div>
                    <label class="block text-xs text-gray-600 mb-1">Heeler</label>
                    <input type="number" class="payout-field-heeler w-full pl-2 pr-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-green-500"
                           data-place="${place}" min="0" step="0.01" placeholder="0" oninput="calculateEventMoney()">
                </div>
            </div>
        `;
    }

    html += '</div>';
    payoutFieldsContainer.innerHTML = html;
    calculateEventMoney();
}

/**
 * Calculate money totals and update display
 */
function calculateEventMoney() {
    // Get values
    const entryFee = parseFloat(document.getElementById('event-entry-fee').value) || 0;
    const stockFeePercent = parseFloat(document.getElementById('event-stock-fee-percent').value) || 0;

    // Count total participants (headers + heelers)
    const selectedHeaders = document.querySelectorAll('.event-header-checkbox:checked').length;
    const selectedHeelers = document.querySelectorAll('.event-heeler-checkbox:checked').length;
    const totalParticipants = selectedHeaders + selectedHeelers;

    // Calculate total expected collections
    const totalCollections = entryFee * totalParticipants;

    // Calculate stock fee amount
    const stockFeeAmount = totalCollections * (stockFeePercent / 100);

    // Calculate pot available for payouts (after stock fee)
    const potAfterStock = totalCollections - stockFeeAmount;

    // Get payout type from toggle (checked = percent, unchecked = dollars)
    const payoutTypeToggle = document.getElementById('event-payout-type-toggle');
    const isPercent = payoutTypeToggle ? payoutTypeToggle.checked : false;

    // Calculate total payouts (handling both dollars and percentages)
    let totalPayouts = 0;
    document.querySelectorAll('.payout-field-header').forEach(input => {
        const value = parseFloat(input.value) || 0;
        if (isPercent) {
            totalPayouts += potAfterStock * (value / 100);
        } else {
            totalPayouts += value;
        }
    });
    document.querySelectorAll('.payout-field-heeler').forEach(input => {
        const value = parseFloat(input.value) || 0;
        if (isPercent) {
            totalPayouts += potAfterStock * (value / 100);
        } else {
            totalPayouts += value;
        }
    });

    // Calculate total profit (collections - stock fee - payouts)
    const totalProfit = totalCollections - stockFeeAmount - totalPayouts;

    // Update display
    document.getElementById('event-total-collections').textContent = `$${totalCollections.toFixed(2)}`;
    document.getElementById('event-stock-fee-amount').textContent = `$${stockFeeAmount.toFixed(2)}`;
    document.getElementById('event-total-payouts').textContent = `$${totalPayouts.toFixed(2)}`;
    document.getElementById('event-total-keep').textContent = `$${totalProfit.toFixed(2)}`;
}

/**
 * Get payout data from form
 * @returns {Array} - Array of payout objects [{place, headerAmount, heelerAmount}]
 */
function getPayouts() {
    const payouts = [];
    const placesToPay = parseInt(document.getElementById('event-places-to-pay').value) || 0;

    for (let place = 1; place <= placesToPay; place++) {
        const headerInput = document.querySelector(`.payout-field-header[data-place="${place}"]`);
        const heelerInput = document.querySelector(`.payout-field-heeler[data-place="${place}"]`);

        if (headerInput && heelerInput) {
            payouts.push({
                place: place,
                headerAmount: parseFloat(headerInput.value) || 0,
                heelerAmount: parseFloat(heelerInput.value) || 0
            });
        }
    }

    return payouts;
}

/**
 * Generate payout fields for modify event section
 */
function generateModifyPayoutFields() {
    const placesToPay = parseInt(document.getElementById('modify-event-places-to-pay').value) || 0;
    const payoutFieldsContainer = document.getElementById('modify-event-payout-fields');

    if (placesToPay === 0) {
        payoutFieldsContainer.innerHTML = '<p class="text-gray-500 italic text-sm">Enter "Places to Pay" above to configure payouts</p>';
        calculateModifyEventMoney();
        return;
    }

    let html = '<div class="space-y-3">';

    // Add payout type toggle at the top
    html += `
        <div class="flex items-center justify-between mb-3">
            <label class="block text-sm font-medium">Payout Amounts by Place</label>
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600">Payout Type:</span>
                <div class="relative inline-flex items-center">
                    <input type="checkbox" id="modify-event-payout-type-toggle" class="hidden" onchange="togglePayoutType('modify')">
                    <label for="modify-event-payout-type-toggle" class="cursor-pointer inline-flex items-center">
                        <div id="modify-payout-toggle-bg" class="w-14 h-7 bg-green-600 rounded-full relative transition-colors">
                            <span class="absolute right-1.5 top-1 text-xs font-bold text-white pointer-events-none">%</span>
                            <span class="absolute left-1.5 top-1 text-xs font-bold text-white pointer-events-none">$</span>
                            <div id="modify-payout-toggle-slider" class="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform"></div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    `;

    for (let place = 1; place <= placesToPay; place++) {
        const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center p-2 bg-white rounded border border-green-200">
                <div class="font-semibold text-sm text-gray-700">${placeLabel} Place:</div>
                <div>
                    <label class="block text-xs text-gray-600 mb-1">Header</label>
                    <input type="number" class="modify-payout-field-header w-full pl-2 pr-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-green-500"
                           data-place="${place}" min="0" step="0.01" placeholder="0" oninput="calculateModifyEventMoney()">
                </div>
                <div>
                    <label class="block text-xs text-gray-600 mb-1">Heeler</label>
                    <input type="number" class="modify-payout-field-heeler w-full pl-2 pr-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-green-500"
                           data-place="${place}" min="0" step="0.01" placeholder="0" oninput="calculateModifyEventMoney()">
                </div>
            </div>
        `;
    }

    html += '</div>';
    payoutFieldsContainer.innerHTML = html;
    calculateModifyEventMoney();
}

/**
 * Calculate money totals for modify event section
 */
function calculateModifyEventMoney() {
    // Get values
    const entryFee = parseFloat(document.getElementById('modify-event-entry-fee').value) || 0;
    const stockFeePercent = parseFloat(document.getElementById('modify-event-stock-fee-percent').value) || 0;

    // Count total participants (headers + heelers)
    const selectedHeaders = document.querySelectorAll('#modify-headers-selection input[type="checkbox"]:checked:not(#modify-select-all-headers)').length;
    const selectedHeelers = document.querySelectorAll('#modify-heelers-selection input[type="checkbox"]:checked:not(#modify-select-all-heelers)').length;
    const totalParticipants = selectedHeaders + selectedHeelers;

    // Calculate total expected collections
    const totalCollections = entryFee * totalParticipants;

    // Calculate stock fee amount
    const stockFeeAmount = totalCollections * (stockFeePercent / 100);

    // Calculate pot available for payouts (after stock fee)
    const potAfterStock = totalCollections - stockFeeAmount;

    // Get payout type from toggle (checked = percent, unchecked = dollars)
    const payoutTypeToggle = document.getElementById('modify-event-payout-type-toggle');
    const isPercent = payoutTypeToggle ? payoutTypeToggle.checked : false;

    // Calculate total payouts (handling both dollars and percentages)
    let totalPayouts = 0;
    document.querySelectorAll('.modify-payout-field-header').forEach(input => {
        const value = parseFloat(input.value) || 0;
        if (isPercent) {
            totalPayouts += potAfterStock * (value / 100);
        } else {
            totalPayouts += value;
        }
    });
    document.querySelectorAll('.modify-payout-field-heeler').forEach(input => {
        const value = parseFloat(input.value) || 0;
        if (isPercent) {
            totalPayouts += potAfterStock * (value / 100);
        } else {
            totalPayouts += value;
        }
    });

    // Calculate total profit (collections - stock fee - payouts)
    const totalProfit = totalCollections - stockFeeAmount - totalPayouts;

    // Update display
    document.getElementById('modify-event-total-collections').textContent = `$${totalCollections.toFixed(2)}`;
    document.getElementById('modify-event-stock-fee-amount').textContent = `$${stockFeeAmount.toFixed(2)}`;
    document.getElementById('modify-event-total-payouts').textContent = `$${totalPayouts.toFixed(2)}`;
    document.getElementById('modify-event-total-keep').textContent = `$${totalProfit.toFixed(2)}`;
}

/**
 * Get payout data from modify event form
 * @returns {Array} - Array of payout objects [{place, headerAmount, heelerAmount}]
 */
function getModifyPayouts() {
    const payouts = [];
    const placesToPay = parseInt(document.getElementById('modify-event-places-to-pay').value) || 0;

    for (let place = 1; place <= placesToPay; place++) {
        const headerInput = document.querySelector(`.modify-payout-field-header[data-place="${place}"]`);
        const heelerInput = document.querySelector(`.modify-payout-field-heeler[data-place="${place}"]`);

        if (headerInput && heelerInput) {
            payouts.push({
                place: place,
                headerAmount: parseFloat(headerInput.value) || 0,
                heelerAmount: parseFloat(heelerInput.value) || 0
            });
        }
    }

    return payouts;
}

// Export money management functions
window.generatePayoutFields = generatePayoutFields;
window.calculateEventMoney = calculateEventMoney;
window.getPayouts = getPayouts;
window.generateModifyPayoutFields = generateModifyPayoutFields;
window.calculateModifyEventMoney = calculateModifyEventMoney;
window.getModifyPayouts = getModifyPayouts;

// Add event listeners to remove invalid-field class when user starts typing
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('invalid-field')) {
        e.target.classList.remove('invalid-field');
    }
});

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'events') {
        loadEventsPage();
    }
});

/**
 * Show participants list modal for an event
 * @param {number} eventId - Event ID
 */
async function showParticipantsModal(eventId) {
    try {
        const event = await dbHelpers.getEvent(eventId);
        if (!event) {
            app.showNotification('Event not found', 'error');
            return;
        }

        // Get all ropers including deleted ones
        const allRopers = await dbHelpers.getAllRopersIncludingDeleted();
        const roperMap = {};
        allRopers.forEach(r => roperMap[r.id] = r);

        // Get participating ropers
        const participants = event.roperIds
            .map(id => roperMap[id])
            .filter(r => r); // Filter out any that don't exist

        // Separate headers and heelers
        const headers = participants.filter(r => r.position === 'header').sort((a, b) => a.name.localeCompare(b.name));
        const heelers = participants.filter(r => r.position === 'heeler').sort((a, b) => a.name.localeCompare(b.name));

        // Update modal content
        document.getElementById('participants-event-info').textContent =
            `${event.name} - ${app.formatDate(event.date)}`;

        // Build participant list HTML
        let listHTML = '';

        if (headers.length > 0) {
            listHTML += `
                <div class="p-3 bg-blue-50">
                    <h4 class="font-semibold text-blue-900 text-sm">Headers</h4>
                </div>
            `;
            headers.forEach(roper => {
                const deletedLabel = roper.deleted ? '<span class="text-xs text-gray-400 ml-2">(Deleted)</span>' : '';
                listHTML += `
                    <div class="p-3 hover:bg-gray-50">
                        <span class="text-gray-800">${roper.name}</span>${deletedLabel}
                    </div>
                `;
            });
        }

        if (heelers.length > 0) {
            listHTML += `
                <div class="p-3 bg-green-50">
                    <h4 class="font-semibold text-green-900 text-sm">Heelers</h4>
                </div>
            `;
            heelers.forEach(roper => {
                const deletedLabel = roper.deleted ? '<span class="text-xs text-gray-400 ml-2">(Deleted)</span>' : '';
                listHTML += `
                    <div class="p-3 hover:bg-gray-50">
                        <span class="text-gray-800">${roper.name}</span>${deletedLabel}
                    </div>
                `;
            });
        }

        document.getElementById('participants-list').innerHTML = listHTML;

        // Update counts
        document.getElementById('participants-total').textContent = participants.length;
        document.getElementById('participants-headers').textContent = headers.length;
        document.getElementById('participants-heelers').textContent = heelers.length;

        // Store event ID and participant data for copying
        window.currentParticipantsData = {
            eventName: event.name,
            eventDate: event.date,
            headers: headers,
            heelers: heelers
        };

        // Show modal
        document.getElementById('participants-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error showing participants:', error);
        app.showNotification('Error loading participants', 'error');
    }
}

/**
 * Close participants modal
 */
function closeParticipantsModal() {
    document.getElementById('participants-modal').classList.add('hidden');
    window.currentParticipantsData = null;
}

/**
 * View participants for the currently selected event in modify dropdown
 */
function viewSelectedEventParticipants() {
    const eventId = parseInt(document.getElementById('modify-event-select').value);
    if (eventId) {
        showParticipantsModal(eventId);
    }
}

/**
 * Copy participants list to clipboard
 */
async function copyParticipantsList() {
    if (!window.currentParticipantsData) return;

    const { eventName, eventDate, headers, heelers } = window.currentParticipantsData;

    // Build text list
    let textList = `${eventName} - ${app.formatDate(eventDate)}\n`;
    textList += `Total Participants: ${headers.length + heelers.length}\n\n`;

    if (headers.length > 0) {
        textList += `Headers (${headers.length}):\n`;
        headers.forEach(roper => {
            textList += `- ${roper.name}\n`;
        });
        textList += '\n';
    }

    if (heelers.length > 0) {
        textList += `Heelers (${heelers.length}):\n`;
        heelers.forEach(roper => {
            textList += `- ${roper.name}\n`;
        });
    }

    try {
        await navigator.clipboard.writeText(textList);
        app.showNotification('Participant list copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback: create a textarea and select it
        const textarea = document.createElement('textarea');
        textarea.value = textList;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            app.showNotification('Participant list copied to clipboard!', 'success');
        } catch (e) {
            app.showNotification('Could not copy to clipboard', 'error');
        }
        document.body.removeChild(textarea);
    }
}

/**
 * Toggle payout type ($ vs %)
 * @param {string} type - 'event' or 'modify'
 */
function togglePayoutType(type) {
    const prefix = type === 'event' ? 'event-payout' : 'modify-payout';
    const toggle = document.getElementById(`${prefix}-type-toggle`);
    const slider = document.getElementById(`${prefix}-toggle-slider`);
    const bg = document.getElementById(`${prefix}-toggle-bg`);

    if (toggle && slider && bg) {
        if (toggle.checked) {
            // Percent mode - slider moves RIGHT to %
            slider.style.transform = 'translateX(28px)';
            bg.classList.remove('bg-green-600');
            bg.classList.add('bg-blue-600');
        } else {
            // Dollar mode - slider stays LEFT on $
            slider.style.transform = 'translateX(0)';
            bg.classList.remove('bg-blue-600');
            bg.classList.add('bg-green-600');
        }
    }

    // Recalculate money
    if (type === 'event') {
        calculateEventMoney();
    } else {
        calculateModifyEventMoney();
    }
}

/**
 * Toggle money management section visibility
 */
function toggleMoneyManagement() {
    const toggle = document.getElementById('event-money-toggle');
    const content = document.getElementById('event-money-content');

    if (toggle.checked) {
        content.classList.remove('hidden');
    } else {
        content.classList.add('hidden');
    }
}

/**
 * Toggle modify money management section visibility
 */
function toggleModifyMoneyManagement() {
    const toggle = document.getElementById('modify-event-money-toggle');
    const content = document.getElementById('modify-event-money-content');

    if (toggle.checked) {
        content.classList.remove('hidden');
    } else {
        content.classList.add('hidden');
    }
}

// Export money toggle functions
window.togglePayoutType = togglePayoutType;
window.toggleMoneyManagement = toggleMoneyManagement;
window.toggleModifyMoneyManagement = toggleModifyMoneyManagement;

// Export participants modal functions
window.showParticipantsModal = showParticipantsModal;
window.closeParticipantsModal = closeParticipantsModal;
window.copyParticipantsList = copyParticipantsList;
window.viewSelectedEventParticipants = viewSelectedEventParticipants;

console.log('Events page script loaded');
