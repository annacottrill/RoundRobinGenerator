/**
 * Manage Ropers Page JavaScript
 * Handles adding, editing, and deleting ropers
 */

/**
 * Load and display all ropers
 */
async function loadRopersPage() {
    try {
        // Reset page state
        document.getElementById('add-roper-form').reset();

        // Hide edit form if visible
        document.getElementById('edit-roper-section').classList.add('hidden');

        // Clear search field
        const searchField = document.getElementById('roper-search');
        if (searchField) searchField.value = '';

        await displayRopers();
    } catch (error) {
        console.error('Error loading ropers page:', error);
        app.showNotification('Error loading ropers', 'error');
    }
}

/**
 * Display all ropers in the list
 * @param {string} searchTerm - Optional search term to filter ropers
 */
async function displayRopers(searchTerm = '') {
    try {
        const ropers = await dbHelpers.getAllRopers();
        const ropersList = document.getElementById('ropers-list');

        if (ropers.length === 0) {
            ropersList.innerHTML = '<p class="text-gray-500 italic">No ropers added yet.</p>';
            return;
        }

        // Filter ropers by search term
        const filteredRopers = searchTerm
            ? ropers.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
            : ropers;

        // Sort ropers by name
        filteredRopers.sort((a, b) => a.name.localeCompare(b.name));

        if (filteredRopers.length === 0) {
            ropersList.innerHTML = '<p class="text-gray-500 italic">No ropers match your search.</p>';
            return;
        }

        ropersList.innerHTML = filteredRopers.map(roper => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div class="flex-grow">
                    <div class="flex items-center gap-3">
                        <h4 class="font-semibold">${roper.name}</h4>
                        <span class="px-2 py-1 rounded text-xs font-medium ${
                            roper.position === 'header' ? 'bg-blue-100 text-blue-800' :
                            roper.position === 'heeler' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                        }">
                            ${roper.position.charAt(0).toUpperCase() + roper.position.slice(1)}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">
                        Skill Level: ${roper.skillLevel}/10
                    </p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editRoper(${roper.id})"
                            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                        Edit
                    </button>
                    <button onclick="deleteRoper(${roper.id}, '${roper.name}')"
                            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error displaying ropers:', error);
    }
}

/**
 * Handle add roper form submission
 */
async function handleAddRoper(e) {
    e.preventDefault();

    try {
        const name = document.getElementById('roper-name').value.trim();
        const position = document.getElementById('roper-position').value;
        const skillLevel = parseInt(document.getElementById('roper-skill').value);

        if (!name || !position) {
            app.showNotification('Please fill in all fields', 'error');
            return;
        }

        // Check for duplicate name in the same position
        const existingRopers = await dbHelpers.getAllRopers();
        const duplicate = existingRopers.find(r =>
            r.name.toLowerCase() === name.toLowerCase() &&
            r.position === position
        );

        if (duplicate) {
            app.showNotification(`A ${position} named "${name}" already exists!`, 'error');
            return;
        }

        // Add roper to database
        await dbHelpers.addRoper({
            name: name,
            position: position,
            skillLevel: skillLevel
        });

        app.showNotification(`${name} added successfully!`, 'success');

        // Reset form
        e.target.reset();
        document.getElementById('roper-skill').value = 5;

        // Refresh the list
        await displayRopers();

        // Update home page stats
        updateStats();
    } catch (error) {
        console.error('Error adding roper:', error);
        app.showNotification('Error adding roper', 'error');
    }
}

/**
 * Edit a roper - shows edit form
 * @param {number} id - Roper ID
 */
async function editRoper(id) {
    try {
        const roper = await dbHelpers.getRoper(id);
        if (!roper) return;

        // Show edit form section
        const editSection = document.getElementById('edit-roper-section');
        editSection.classList.remove('hidden');

        // Populate form with current values
        document.getElementById('edit-roper-id').value = roper.id;
        document.getElementById('edit-roper-name').value = roper.name;
        document.getElementById('edit-roper-position').value = roper.position;
        document.getElementById('edit-roper-skill').value = roper.skillLevel;

        // Scroll to edit form
        editSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error('Error loading roper for edit:', error);
        app.showNotification('Error loading roper', 'error');
    }
}

/**
 * Cancel editing and hide the edit form
 */
function cancelEditRoper() {
    const editSection = document.getElementById('edit-roper-section');
    editSection.classList.add('hidden');
    document.getElementById('edit-roper-form').reset();
}

/**
 * Handle edit roper form submission
 */
async function handleEditRoper(e) {
    e.preventDefault();

    try {
        const id = parseInt(document.getElementById('edit-roper-id').value);
        const name = document.getElementById('edit-roper-name').value.trim();
        const position = document.getElementById('edit-roper-position').value;
        const skillLevel = parseInt(document.getElementById('edit-roper-skill').value);

        if (!name || !position) {
            app.showNotification('Please fill in all fields', 'error');
            return;
        }

        // Check for duplicate name in the same position (excluding current roper)
        const existingRopers = await dbHelpers.getAllRopers();
        const duplicate = existingRopers.find(r =>
            r.id !== id &&
            r.name.toLowerCase() === name.toLowerCase() &&
            r.position === position
        );

        if (duplicate) {
            app.showNotification(`A ${position} named "${name}" already exists!`, 'error');
            return;
        }

        await dbHelpers.updateRoper(id, {
            name: name,
            position: position,
            skillLevel: skillLevel
        });

        app.showNotification('Roper updated successfully!', 'success');

        // Hide edit form and refresh list
        cancelEditRoper();
        await displayRopers();
    } catch (error) {
        console.error('Error editing roper:', error);
        app.showNotification('Error updating roper', 'error');
    }
}

/**
 * Delete a roper
 * @param {number} id - Roper ID
 * @param {string} name - Roper name (for confirmation)
 */
async function deleteRoper(id, name) {
    try {
        // Check if roper is used in any events
        const usageInfo = await dbHelpers.isRoperUsedInEvents(id);

        let confirmMessage;
        if (usageInfo.isUsed) {
            const eventText = usageInfo.eventCount === 1 ? 'event' : 'events';
            confirmMessage = `${name} is in ${usageInfo.eventCount} ${eventText}. They will be hidden from active lists but their data will be preserved in events. Are you sure you want to delete ${name}?`;
        } else {
            confirmMessage = `Are you sure you want to delete ${name}?`;
        }

        const confirmed = await app.confirm(confirmMessage, 'Delete Roper');
        if (!confirmed) return;

        await dbHelpers.deleteRoper(id);

        app.showNotification(`${name} deleted successfully`, 'success');

        // Refresh the list
        await displayRopers();

        // Update home page stats
        updateStats();
    } catch (error) {
        console.error('Error deleting roper:', error);
        app.showNotification('Error deleting roper', 'error');
    }
}

// Set up form submission handlers
document.getElementById('add-roper-form').addEventListener('submit', handleAddRoper);
document.getElementById('edit-roper-form').addEventListener('submit', handleEditRoper);

// Set up search handler
document.getElementById('ropers-search').addEventListener('input', (e) => {
    displayRopers(e.target.value);
});

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'ropers') {
        loadRopersPage();
    }
});

// Export functions to global scope
window.editRoper = editRoper;
window.deleteRoper = deleteRoper;
window.cancelEditRoper = cancelEditRoper;

console.log('Ropers page script loaded');
