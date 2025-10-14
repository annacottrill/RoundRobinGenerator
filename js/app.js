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

        // Initialize router
        router.init();

        // Set up online/offline status monitoring
        this.setupOnlineStatus();

        // Set up global error handling
        this.setupErrorHandling();

        // Load initial data
        await this.loadInitialData();

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
            // This will be called when the app loads
            // Page-specific loaders will handle their own data
            console.log('Initial data loaded');
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
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export app
window.app = app;

console.log('App loaded');
