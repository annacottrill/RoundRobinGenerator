/**
 * Main Application Entry Point
 *
 * Initializes the app, sets up global functionality,
 * and manages online/offline status
 */

const app = {
    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Round Robin Roping App...');

        // Set up online/offline status monitoring
        this.setupOnlineStatus();

        // Set up global error handling
        this.setupErrorHandling();

        // Load initial data and ensure DB is ready
        await this.loadInitialData();

        // Update storage display
        await this.updateStorageDisplay();

        // Initialize router after DB is ready
        router.init();

        console.log('App initialized successfully');
    },

    /**
     * Set up online/offline status indicator
     */
    setupOnlineStatus() {
        const updateOnlineStatus = () => {
            const statusDot = document.getElementById('online-status');
            const statusText = document.getElementById('status-text');

            if (navigator.onLine) {
                statusDot.classList.remove('bg-red-500');
                statusDot.classList.add('bg-green-500');
                statusText.textContent = 'Online';
            } else {
                statusDot.classList.remove('bg-green-500');
                statusDot.classList.add('bg-red-500');
                statusText.textContent = 'Offline';
            }
        };

        // Initial status
        updateOnlineStatus();

        // Listen for changes
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    },

    /**
     * Set up global error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showNotification('An error occurred. Please try again.', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showNotification('An error occurred. Please try again.', 'error');
        });
    },

    /**
     * Load initial data and update dashboard
     */
    async loadInitialData() {
        try {
            // Make test queries to ensure database is ready and migrations are complete
            // Dexie will automatically open the database on first query
            await db.ropers.count();
            await db.events.count();
            await db.runs.count();

            console.log('Database ready, initial data loaded');
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    },

    /**
     * Show a notification message to the user
     * @param {string} message - Message to display
     * @param {string} type - Type of notification ('success', 'error', 'info')
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-full`;

        // Set color based on type
        if (type === 'success') {
            notification.classList.add('bg-green-600');
        } else if (type === 'error') {
            notification.classList.add('bg-red-600');
        } else {
            notification.classList.add('bg-blue-600');
        }

        notification.textContent = message;

        // Add to DOM
        document.body.appendChild(notification);

        // Slide in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    },

    /**
     * Show a confirmation dialog with custom modal
     * @param {string} message - Message to display
     * @param {string} title - Optional title (defaults to "Confirm Action")
     * @returns {Promise<boolean>} - True if confirmed, false if cancelled
     */
    async confirm(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const modalTitle = document.getElementById('confirm-modal-title');
            const modalMessage = document.getElementById('confirm-modal-message');
            const confirmBtn = document.getElementById('confirm-modal-confirm');
            const cancelBtn = document.getElementById('confirm-modal-cancel');

            // Set message and title
            modalTitle.textContent = title;
            modalMessage.textContent = message;

            // Show modal
            modal.classList.remove('hidden');

            // Handle confirm
            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            // Handle cancel
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            // Cleanup function to remove listeners and hide modal
            const cleanup = () => {
                modal.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleBackdropClick);
            };

            // Handle backdrop click (clicking outside the modal)
            const handleBackdropClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            // Add event listeners
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleBackdropClick);
        });
    },

    /**
     * Format time for display
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time string (e.g., "5.43")
     */
    formatTime(seconds) {
        if (seconds === null || seconds === undefined) {
            return 'N/A';
        }
        return seconds.toFixed(2);
    },

    /**
     * Format date for display
     * @param {Date|string} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} - Today's date
     */
    getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Parse a YYYY-MM-DD date string to a Date object in local timezone
     * Avoids timezone conversion issues when parsing date strings
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {Date} - Date object at midnight local time
     */
    parseLocalDate(dateString) {
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        return new Date(year, month - 1, day);
    },

    /**
     * Generate round robin pairings with predictable rotation
     * Each header ropes with each heeler exactly once
     * Headers go in the same order every round
     * Heelers rotate through the list in a predictable pattern
     *
     * Example with 3 headers (H1, H2, H3) and 3 heelers (L1, L2, L3):
     * Round 1: H1-L1, H2-L2, H3-L3
     * Round 2: H1-L2, H2-L3, H3-L1
     * Round 3: H1-L3, H2-L1, H3-L2
     *
     * @param {Array} headers - Array of header ropers (already sorted)
     * @param {Array} heelers - Array of heeler ropers (already sorted)
     * @returns {Array} - Array of pairings [{headerId, heelerId, round}]
     */
    generateRoundRobinPairings(headers, heelers) {
        const pairings = [];
        const numHeaders = headers.length;
        const numHeelers = heelers.length;
        let runNumber = 1;

        // We need enough rounds so each header ropes with each heeler once
        const numRounds = numHeelers;

        // For each round
        for (let round = 0; round < numRounds; round++) {
            // For each header position
            for (let headerIndex = 0; headerIndex < numHeaders; headerIndex++) {
                // Calculate which heeler this header pairs with
                // Rotate heelers: each round, shift the starting position
                const heelerIndex = (headerIndex + round) % numHeelers;

                pairings.push({
                    headerId: headers[headerIndex].id,
                    heelerId: heelers[heelerIndex].id,
                    round: runNumber
                });

                runNumber++;
            }
        }

        return pairings;
    },

    /**
     * Shuffle array (for randomizing pairings if needed)
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Clear all data from the database
     */
    async clearAllData() {
        try {
            await db.ropers.clear();
            await db.events.clear();
            await db.runs.clear();

            this.showNotification('All data has been cleared', 'success');

            // Reload the current page to show empty state
            const currentPage = document.querySelector('.page.active').id.replace('page-', '');
            window.dispatchEvent(new CustomEvent('pageload', { detail: { page: currentPage } }));

            // Navigate to home
            setTimeout(() => {
                router.navigate('home');
            }, 500);
        } catch (error) {
            console.error('Error clearing data:', error);
            this.showNotification('Error clearing data', 'error');
        }
    },

    /**
     * Get storage usage information using Storage API
     * @returns {Promise<Object>} - Object with usage, quota, and percentage
     */
    async getStorageInfo() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 0;
                const percentUsed = quota > 0 ? (usage / quota * 100) : 0;

                return {
                    usage: usage,
                    quota: quota,
                    percentUsed: percentUsed,
                    usageFormatted: this.formatBytes(usage),
                    quotaFormatted: this.formatBytes(quota),
                    percentFormatted: percentUsed.toFixed(2) + '%'
                };
            } else {
                // Storage API not supported
                return {
                    usage: 0,
                    quota: 0,
                    percentUsed: 0,
                    usageFormatted: 'Unknown',
                    quotaFormatted: 'Unknown',
                    percentFormatted: 'N/A',
                    unsupported: true
                };
            }
        } catch (error) {
            console.error('Error getting storage info:', error);
            return {
                usage: 0,
                quota: 0,
                percentUsed: 0,
                usageFormatted: 'Error',
                quotaFormatted: 'Error',
                percentFormatted: 'N/A',
                error: true
            };
        }
    },

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} - Formatted string (e.g., "2.5 MB")
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (!bytes || isNaN(bytes)) return 'N/A';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Update storage display in footer
     */
    async updateStorageDisplay() {
        const storageInfo = await this.getStorageInfo();
        const storageElement = document.getElementById('storage-info');

        if (storageElement) {
            if (storageInfo.unsupported) {
                storageElement.textContent = 'Storage: N/A';
            } else if (storageInfo.error) {
                storageElement.textContent = 'Storage: Error';
            } else {
                // Show as "X / Y" format for clarity
                storageElement.textContent = `Storage: ${storageInfo.usageFormatted} / ${storageInfo.quotaFormatted}`;

                // Show warning if storage is over 80%
                if (storageInfo.percentUsed > 80) {
                    storageElement.classList.add('text-yellow-400');
                } else {
                    storageElement.classList.remove('text-yellow-400');
                }
            }
        }
    }
};

// Initialize app when DOM is ready and all scripts are loaded
console.log('app.js: document.readyState =', document.readyState);

// Use a more reliable initialization approach
function initializeApp() {
    console.log('initializeApp() called');
    app.init().catch(err => console.error('Error during app initialization:', err));
}

// Check if we're already loaded
if (document.readyState === 'complete') {
    console.log('Document already complete, using setTimeout');
    // Use setTimeout to ensure all inline scripts have executed
    setTimeout(initializeApp, 0);
} else if (document.readyState === 'interactive') {
    console.log('Document interactive, waiting for load event');
    window.addEventListener('load', initializeApp);
} else {
    console.log('Document loading, waiting for load event');
    window.addEventListener('load', initializeApp);
}

// Export app
window.app = app;

/**
 * Show the clear data modal
 */
function showClearDataModal() {
    const modal = document.getElementById('clear-data-modal');
    const input = document.getElementById('clear-data-confirm-input');
    const confirmBtn = document.getElementById('clear-data-modal-confirm');
    const error = document.getElementById('clear-data-error');

    // Reset modal state
    input.value = '';
    confirmBtn.disabled = true;
    error.classList.add('hidden');

    // Show modal
    modal.classList.remove('hidden');

    // Focus input
    setTimeout(() => input.focus(), 100);
}

/**
 * Hide the clear data modal
 */
function hideClearDataModal() {
    const modal = document.getElementById('clear-data-modal');
    const input = document.getElementById('clear-data-confirm-input');
    const error = document.getElementById('clear-data-error');

    modal.classList.add('hidden');
    input.value = '';
    error.classList.add('hidden');
}

/**
 * Handle the clear data confirmation
 */
async function handleClearDataConfirm() {
    const input = document.getElementById('clear-data-confirm-input');
    const error = document.getElementById('clear-data-error');

    if (input.value === 'DELETE') {
        hideClearDataModal();
        await app.clearAllData();
    } else {
        error.classList.remove('hidden');
        input.focus();
        input.select();
    }
}

// Set up modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('clear-data-modal');
    const input = document.getElementById('clear-data-confirm-input');
    const confirmBtn = document.getElementById('clear-data-modal-confirm');
    const cancelBtn = document.getElementById('clear-data-modal-cancel');

    // Enable/disable confirm button based on input
    input.addEventListener('input', () => {
        confirmBtn.disabled = input.value !== 'DELETE';
    });

    // Handle confirm button click
    confirmBtn.addEventListener('click', handleClearDataConfirm);

    // Handle cancel button click
    cancelBtn.addEventListener('click', hideClearDataModal);

    // Handle Enter key in input
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value === 'DELETE') {
            handleClearDataConfirm();
        }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideClearDataModal();
        }
    });
});

// Export functions to global scope
window.showClearDataModal = showClearDataModal;
window.hideClearDataModal = hideClearDataModal;

console.log('App loaded');
