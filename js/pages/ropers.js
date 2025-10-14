/**
 * Manage Ropers Page JavaScript
 * Handles adding, editing, and deleting ropers
 */

/**
 * Load and display all ropers
 */
async function loadRopersPage() {
    try {
        await displayRopers();
    } catch (error) {
        console.error('Error loading ropers page:', error);
        app.showNotification('Error loading ropers', 'error');
    }
}

/**
 * Display all ropers in the list
 */
async function displayRopers() {
    try {
        const ropers = await dbHelpers.getAllRopers();
        const ropersList = document.getElementById('ropers-list');

        if (ropers.length === 0) {
            ropersList.innerHTML = '<p class="text-gray-500 italic">No ropers added yet.</p>';
            return;
        }

        // Sort ropers by name
        ropers.sort((a, b) => a.name.localeCompare(b.name));

        ropersList.innerHTML = ropers.map(roper => `
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
 * Edit a roper (placeholder for future enhancement)
 * @param {number} id - Roper ID
 */
async function editRoper(id) {
    try {
        const roper = await dbHelpers.getRoper(id);
        if (!roper) return;

        // Simple prompt-based editing (can be enhanced with a modal)
        const newName = prompt('Enter new name:', roper.name);
        if (!newName) return;

        const newPosition = prompt('Enter position (header/heeler):', roper.position);
        if (!newPosition) return;

        const newSkill = prompt('Enter skill level (1-10):', roper.skillLevel);
        if (!newSkill) return;

        await dbHelpers.updateRoper(id, {
            name: newName.trim(),
            position: newPosition.toLowerCase(),
            skillLevel: parseInt(newSkill)
        });

        app.showNotification('Roper updated successfully!', 'success');
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
        const confirmed = await app.confirm(`Are you sure you want to delete ${name}?`);
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

// Set up form submission handler
document.getElementById('add-roper-form').addEventListener('submit', handleAddRoper);

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'ropers') {
        loadRopersPage();
    }
});

// Export functions to global scope
window.editRoper = editRoper;
window.deleteRoper = deleteRoper;

console.log('Ropers page script loaded');
