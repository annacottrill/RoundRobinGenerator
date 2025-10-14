/**
 * Home Page JavaScript
 * Handles the dashboard/home page functionality
 */

/**
 * Load and display home page data
 */
async function loadHomePage() {
    try {
        // Update statistics
        await updateStats();

        // Load recent events
        await loadRecentEvents();
    } catch (error) {
        console.error('Error loading home page:', error);
        app.showNotification('Error loading dashboard data', 'error');
    }
}

/**
 * Update dashboard statistics
 */
async function updateStats() {
    try {
        const stats = await dbHelpers.getStats();

        const ropersStat = document.getElementById('stat-ropers');
        const eventsStat = document.getElementById('stat-events');
        const runsStat = document.getElementById('stat-runs');

        if (ropersStat) {
            ropersStat.textContent = stats.ropers;
        }
        if (eventsStat) {
            eventsStat.textContent = stats.events;
        }
        if (runsStat) {
            runsStat.textContent = stats.runs;
        }

        // Update storage info on home page
        const storageInfo = await app.getStorageInfo();
        const homeStorageElement = document.getElementById('home-storage-info');
        if (homeStorageElement) {
            if (storageInfo.unsupported) {
                homeStorageElement.textContent = 'Not Available';
            } else if (storageInfo.error) {
                homeStorageElement.textContent = 'Error';
            } else {
                // Show as "X / Y (Z%)" format for more context
                homeStorageElement.textContent = `${storageInfo.usageFormatted} / ${storageInfo.quotaFormatted} (${storageInfo.percentFormatted})`;

                // Show warning color if over 80%
                if (storageInfo.percentUsed > 80) {
                    homeStorageElement.classList.add('text-yellow-600');
                } else {
                    homeStorageElement.classList.remove('text-yellow-600');
                }
            }
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

/**
 * Load and display recent events
 */
async function loadRecentEvents() {
    try {
        const events = await dbHelpers.getAllEvents();
        const recentEventsContainer = document.getElementById('recent-events');

        if (events.length === 0) {
            recentEventsContainer.innerHTML = '<p class="text-gray-500 italic">No events yet. Create your first event!</p>';
            return;
        }

        // Show only the 5 most recent events
        const recentEvents = events.slice(0, 5);

        recentEventsContainer.innerHTML = recentEvents.map(event => `
            <div class="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                 onclick="router.navigate('results'); setTimeout(() => { document.getElementById('results-event-select').value = ${event.id}; document.getElementById('results-event-select').dispatchEvent(new Event('change')); }, 100);">
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-semibold">${event.name}</h4>
                        <p class="text-sm text-gray-600">${app.formatDate(event.date)}</p>
                    </div>
                    <div class="text-right">
                        <span class="inline-block px-3 py-1 rounded-full text-sm ${
                            event.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }">
                            ${event.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent events:', error);
    }
}

// Listen for page load events
window.addEventListener('pageload', (e) => {
    if (e.detail.page === 'home') {
        loadHomePage();
    }
});

// Export functions so they can be called from other pages and the router
window.loadHomePage = loadHomePage;
window.updateStats = updateStats;
