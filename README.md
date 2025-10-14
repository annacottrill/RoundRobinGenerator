# Round Robin Roping - Progressive Web App

A Progressive Web App for managing team roping round robin events. Works completely offline after initial load.

## Features

- **Manage Ropers**: Add, edit, and delete ropers with names, positions (header/heeler/both), and skill levels
- **Create Events**: Set up roping events with selected participants
- **Generate Pairings**: Automatically create round robin team pairings (every header with every heeler)
- **Record Times**: Track run times for each team during the event
- **View Results**: Display standings sorted by time with statistics
- **Offline Support**: Full functionality without internet connection after initial load

## Technology Stack

- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Database**: IndexedDB with Dexie.js wrapper
- **PWA Features**: Service Worker for offline caching, Web App Manifest for installation
- **Architecture**: Single-page application with client-side routing

## Project Structure

```
roundrobin/
├── index.html              # Main HTML file with all page layouts
├── manifest.json           # PWA manifest for installation
├── sw.js                   # Service Worker for offline functionality
├── icons/                  # PWA icons (various sizes)
│   └── (icon files)
├── js/
│   ├── db.js              # IndexedDB schema and database helpers
│   ├── router.js          # Client-side routing
│   ├── app.js             # Main application logic
│   └── pages/
│       ├── home.js        # Dashboard/home page
│       ├── ropers.js      # Manage ropers functionality
│       ├── events.js      # Create events and generate pairings
│       ├── record.js      # Record run times
│       └── results.js     # View results and standings
└── README.md              # This file
```

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (required for Service Worker and PWA features)

### Installation & Running Locally

#### Option 1: Using Python's Built-in Server

If you have Python 3 installed:

```bash
# Navigate to the project directory
cd roundrobin

# Start the server
python3 -m http.server 8000

# Or with Python 2
python -m SimpleHTTPServer 8000
```

Then open your browser to: `http://localhost:8000`

#### Option 2: Using Node.js http-server

If you have Node.js installed:

```bash
# Install http-server globally (one time)
npm install -g http-server

# Navigate to the project directory
cd roundrobin

# Start the server
http-server -p 8000
```

Then open your browser to: `http://localhost:8000`

#### Option 3: Using PHP's Built-in Server

If you have PHP installed:

```bash
# Navigate to the project directory
cd roundrobin

# Start the server
php -S localhost:8000
```

Then open your browser to: `http://localhost:8000`

#### Option 4: Using VS Code Live Server Extension

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Installing as PWA

Once the app is running in your browser:

1. **On Desktop (Chrome/Edge)**:
   - Click the install icon in the address bar (looks like a computer with a down arrow)
   - Or go to the browser menu → "Install Round Robin Roping"

2. **On Mobile (iOS Safari)**:
   - Tap the Share button
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add"

3. **On Mobile (Android Chrome)**:
   - Tap the menu (three dots)
   - Tap "Add to Home screen" or "Install app"
   - Tap "Install"

## Usage Guide

### 1. Add Ropers

Before creating an event, you need to add ropers:

1. Navigate to **Manage Ropers** page
2. Fill in the form:
   - **Name**: Roper's name
   - **Position**: Header, Heeler, or Both
   - **Skill Level**: 1-10 rating
3. Click **Add Roper**

### 2. Create an Event

1. Navigate to **Create Event** page
2. Enter event details:
   - **Event Name**: Give your event a name
   - **Date**: Select the event date
3. Select participating ropers (checkboxes)
4. Click **Create Event & Generate Pairings**
5. The app will automatically generate all round robin pairings

### 3. Record Times

1. Navigate to **Record Times** page
2. Select the event from the dropdown
3. For each team:
   - Enter the time in seconds (e.g., 5.43)
   - Click **Record**
4. Previously recorded times can be edited by clicking **Edit**

### 4. View Results

1. Navigate to **View Results** page
2. Select the event from the dropdown
3. See standings sorted by time (fastest first)
4. View event statistics:
   - Total teams
   - Completed runs
   - Pending runs
   - Average time

## Database Schema

### Ropers Table
- `id`: Auto-incremented primary key
- `name`: Roper's name
- `position`: "header", "heeler", or "both"
- `skillLevel`: Integer 1-10
- `createdAt`: Timestamp

### Events Table
- `id`: Auto-incremented primary key
- `name`: Event name
- `date`: Event date
- `roperIds`: Array of participating roper IDs
- `pairings`: Array of pairing objects
- `createdAt`: Timestamp
- `status`: "active" or "completed"

### Runs Table
- `id`: Auto-incremented primary key
- `eventId`: Foreign key to events
- `headerId`: Foreign key to ropers
- `heelerId`: Foreign key to ropers
- `time`: Run time in seconds (decimal)
- `round`: Round number
- `completed`: Boolean
- `recordedAt`: Timestamp

## Offline Functionality

The app uses a Service Worker to cache all assets on first load. After that:

- All pages work without internet
- Data is stored locally in IndexedDB
- Create events, record times, and view results offline
- The online/offline status is displayed in the footer

### Cache Strategy

- **App Shell**: Cached on install (HTML, JS, CSS)
- **Static Assets**: Cache First with Network Fallback
- **Runtime Cache**: Network resources cached as they're loaded

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- iOS Safari 13+
- Android Chrome 80+

All modern browsers with Service Worker and IndexedDB support.

## Development Notes

### Adding New Features

1. **Database Changes**: Modify `js/db.js` to add new tables or fields
2. **UI Changes**: Edit `index.html` for layout changes
3. **Page Logic**: Create or modify files in `js/pages/` for page-specific functionality
4. **Service Worker**: Update `sw.js` and increment `CACHE_NAME` when modifying assets

### Debugging

- Open browser DevTools (F12)
- **Console**: View logs and errors
- **Application tab**:
  - Inspect Service Worker status
  - View IndexedDB data
  - Check Cache Storage
  - Test offline mode

### Clearing Data

To reset the app and clear all data:

```javascript
// Open browser console and run:
await dbHelpers.clearAllData();
```

Or use DevTools → Application → Storage → "Clear site data"

## Future Enhancement Ideas

- [ ] Edit ropers with a modal instead of prompts
- [ ] Delete events
- [ ] Export results to CSV
- [ ] Print-friendly results page
- [ ] Team photos/avatars
- [ ] Multiple rounds (go-rounds)
- [ ] Handicap scoring system
- [ ] Event templates
- [ ] Backup/restore data
- [ ] Dark mode
- [ ] Search/filter ropers
- [ ] Statistics per roper (average times, win rate, etc.)

## Troubleshooting

### PWA Not Installing
- Ensure you're running on HTTPS or localhost
- Check that manifest.json and Service Worker are loading correctly
- Verify icons exist in the icons/ directory

### Service Worker Not Updating
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Unregister old service worker in DevTools → Application → Service Workers
- Increment CACHE_NAME in sw.js

### Data Not Persisting
- Check browser storage quota (DevTools → Application → Storage)
- Verify IndexedDB is enabled in browser settings
- Check for browser privacy modes that block storage

### Offline Mode Not Working
- Verify Service Worker is registered (DevTools → Application → Service Workers)
- Check Network tab to ensure resources are being served from cache
- Try unregistering and re-registering the Service Worker

## License

This project is provided as-is for personal and commercial use.

## Credits

Built with:
- [Tailwind CSS](https://tailwindcss.com/)
- [Dexie.js](https://dexie.org/)

---

**Note**: This is a fully functional PWA starter with placeholder functionality. You can expand and customize it based on your specific needs for team roping events.
