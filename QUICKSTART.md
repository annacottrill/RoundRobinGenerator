# Quick Start Guide

Get your Round Robin Roping PWA up and running in 5 minutes!

## Step 1: Start a Local Server

Choose one method:

### Using Python (Easiest)
```bash
cd roundrobin
python3 -m http.server 8000
```

### Using Node.js
```bash
npm install -g http-server
cd roundrobin
http-server -p 8000
```

### Using PHP
```bash
cd roundrobin
php -S localhost:8000
```

## Step 2: Open in Browser

Navigate to: `http://localhost:8000`

## Step 3: Add Icons (Optional)

The app will work without icons, but for a complete PWA experience:

1. Open `http://localhost:8000/create-icons.html`
2. Download the generated icons
3. Save them to the `icons/` folder

Or use a professional tool like [PWA Builder](https://www.pwabuilder.com/imageGenerator)

## Step 4: Test the App

1. **Add some ropers**
   - Go to "Manage Ropers"
   - Add at least 2 headers and 2 heelers

2. **Create an event**
   - Go to "Create Event"
   - Name your event
   - Select ropers
   - Click "Create Event & Generate Pairings"

3. **Record times**
   - Go to "Record Times"
   - Select your event
   - Enter times for each team

4. **View results**
   - Go to "View Results"
   - Select your event
   - See the standings!

## Step 5: Test Offline Mode

1. Open browser DevTools (F12)
2. Go to Network tab
3. Check "Offline" mode
4. Refresh the page
5. App should still work!

## Step 6: Install as PWA

### On Desktop
- Click the install icon in the address bar
- Or: Browser menu → "Install Round Robin Roping"

### On Mobile
- **iOS**: Share → Add to Home Screen
- **Android**: Menu → Install app

## Troubleshooting

**PWA not installing?**
- Icons need to exist (see Step 3)
- Must be on localhost or HTTPS
- Try hard refresh (Ctrl+Shift+R)

**Service Worker not working?**
- Check Console for errors
- DevTools → Application → Service Workers
- Unregister and reload

**Data not saving?**
- Check browser allows IndexedDB
- Check storage quota in DevTools
- Disable private/incognito mode

## Next Steps

- Customize the UI colors in `index.html` (Tailwind classes)
- Add more features from the TODO list in README.md
- Deploy to a web server or hosting service
- Share with your team roping community!

## Need Help?

Check the full README.md for detailed documentation.
