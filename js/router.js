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
        console.log('Router init() called');
        // Listen for hash changes (back/forward navigation)
        window.addEventListener('hashchange', () => {
            console.log('Hash changed, calling handleRoute');
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
        console.log('Router init: handling initial route');
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
        console.log('handleRoute() called, hash:', window.location.hash);
        // Get page from hash, default to 'home'
        let page = window.location.hash.slice(1) || 'home';
        console.log('Page determined:', page);

        // Validate page exists
        const validPages = ['home', 'ropers', 'events', 'record', 'results'];
        if (!validPages.includes(page)) {
            page = 'home';
        }

        console.log('Calling showPage with:', page);
        this.showPage(page);
    },

    /**
     * Show a specific page and hide others
     * @param {string} page - Page name to show
     */
    showPage(page) {
        console.log('showPage() called with page:', page);
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Show the requested page
        const pageElement = document.getElementById(`page-${page}`);
        console.log('Page element found:', !!pageElement);
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
        console.log('About to call triggerPageLoad');
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
        console.log('triggerPageLoad called for page:', page);
        const event = new CustomEvent('pageload', { detail: { page } });
        window.dispatchEvent(event);

        // Call page-specific load function if it exists
        const loadFunctionName = `load${page.charAt(0).toUpperCase() + page.slice(1)}Page`;
        console.log('Looking for function:', loadFunctionName, 'exists:', typeof window[loadFunctionName] === 'function');
        if (typeof window[loadFunctionName] === 'function') {
            console.log('Calling', loadFunctionName);
            window[loadFunctionName]();
        } else {
            console.log('Function not found:', loadFunctionName);
        }
    }
};

// Export router
window.router = router;

console.log('Router initialized');
