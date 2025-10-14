/**
 * Simple Client-Side Router
 *
 * Handles navigation between different pages in the single-page application
 * Uses URL hash (#) for routing
 */

const router = {
    // Current active page
    currentPage: null,

    /**
     * Initialize the router
     * Sets up event listeners for navigation
     */
    init() {
        // Listen for hash changes (back/forward navigation)
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });

        // Listen for navigation link clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nav-link') || e.target.closest('.nav-link')) {
                e.preventDefault();
                const link = e.target.matches('.nav-link') ? e.target : e.target.closest('.nav-link');
                const page = link.getAttribute('data-page');
                if (page) {
                    this.navigate(page);
                }
            }
        });

        // Handle initial route
        this.handleRoute();
    },

    /**
     * Navigate to a specific page
     * @param {string} page - Page name to navigate to
     */
    navigate(page) {
        // Update URL hash
        window.location.hash = page;
    },

    /**
     * Handle the current route
     * Shows the appropriate page based on the URL hash
     */
    handleRoute() {
        // Get page from hash, default to 'home'
        let page = window.location.hash.slice(1) || 'home';

        // Validate page exists
        const validPages = ['home', 'ropers', 'events', 'record', 'results'];
        if (!validPages.includes(page)) {
            page = 'home';
        }

        this.showPage(page);
    },

    /**
     * Show a specific page and hide others
     * @param {string} page - Page name to show
     */
    showPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Show the requested page
        const pageElement = document.getElementById(`page-${page}`);
        if (pageElement) {
            pageElement.classList.add('active');
        }

        // Update navigation active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Update current page
        this.currentPage = page;

        // Trigger page-specific load event
        this.triggerPageLoad(page);

        // Scroll to top
        window.scrollTo(0, 0);
    },

    /**
     * Trigger page-specific load events
     * Allows pages to refresh their content when navigated to
     * @param {string} page - Page that was loaded
     */
    triggerPageLoad(page) {
        const event = new CustomEvent('pageload', { detail: { page } });
        window.dispatchEvent(event);

        // Call page-specific load function if it exists
        const loadFunctionName = `load${page.charAt(0).toUpperCase() + page.slice(1)}Page`;
        if (typeof window[loadFunctionName] === 'function') {
            window[loadFunctionName]();
        }
    }
};

// Export router
window.router = router;
