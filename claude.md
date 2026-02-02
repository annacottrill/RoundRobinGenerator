# Development Notes

## Cache-Busting for JavaScript Updates

**IMPORTANT:** Whenever you make changes to JavaScript files, you MUST update the version number in `index.html` to force browsers to reload the new files.

### Steps:

1. Make your JavaScript changes
2. Open `index.html` (around line 1537-1544)
3. Update the version number in all script tags:
   ```html
   <!-- Change from -->
   <script src="js/db.js?v=20260201"></script>

   <!-- To (increment the date or add a counter) -->
   <script src="js/db.js?v=20260202"></script>
   ```
4. Update ALL script tags with the same new version number
5. Commit and deploy

### Why?

Mobile browsers (especially Chrome on mobile) aggressively cache JavaScript files. Without updating the version parameter, users may not see your changes even after clearing their cache.

### Quick Reference:

Current version format: `?v=YYYYMMDD` or `?v=YYYYMMDD-X` (where X is a counter for same-day updates)

Example versions:
- `?v=20260201` - First deploy on Feb 1, 2026
- `?v=20260201-2` - Second deploy on Feb 1, 2026
- `?v=20260202` - First deploy on Feb 2, 2026

---

## Other Notes

Add any other development reminders or notes here as needed.
