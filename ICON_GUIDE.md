# Icon Usage Guide

This document explains exactly where each icon is used and what sizes you need.

## Icon Files Needed

You need to create 8 PNG files in the `icons/` folder:

```
icons/
├── icon-72.png      (72x72 pixels)
├── icon-96.png      (96x96 pixels)
├── icon-128.png     (128x128 pixels)
├── icon-144.png     (144x144 pixels)
├── icon-152.png     (152x152 pixels)
├── icon-192.png     (192x192 pixels)
├── icon-384.png     (384x384 pixels)
└── icon-512.png     (512x512 pixels)
```

## Where Each Icon is Used

### 1. Browser Tab (Favicon)
**File**: `icon-192.png`
**Location**: `index.html` line 14
**Purpose**: Shows in browser tab/bookmark
**Code**:
```html
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
```

### 2. iOS Home Screen
**File**: `icon-192.png`
**Location**: `index.html` line 15
**Purpose**: Shows when app is added to iOS home screen
**Code**:
```html
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

### 3. PWA Manifest (All Sizes)
**Files**: All 8 icon sizes
**Location**: `manifest.json` lines 10-58
**Purpose**: Used by different devices when installing PWA

| Size | Used For | Purpose |
|------|----------|---------|
| 72×72 | Android small | Small Android devices, older phones |
| 96×96 | Android medium | Medium Android devices |
| 128×128 | Desktop Chrome | Small desktop icon |
| 144×144 | Windows tiles | Windows 10/11 live tiles |
| 152×152 | iOS/iPad | iPad home screen |
| 192×192 | **Most common** | Android home screen, Chrome |
| 384×384 | High-DPI displays | Retina/high resolution screens |
| 512×512 | Splash screens | Loading screens, app stores |

### 4. Maskable Icons (Special)
**Files**: `icon-192.png` and `icon-512.png`
**Purpose**: Android adaptive icons (can be cropped to different shapes)
**Note**: These use `"purpose": "any maskable"` in manifest

## Icon Requirements

### Design Guidelines

1. **Safe Zone**: Keep important elements in the center 80% of the icon
2. **Shapes**: Avoid text/logos near edges (Android crops to circles/rounded squares)
3. **Colors**: High contrast, works on light and dark backgrounds
4. **Simplicity**: Recognizable at small sizes (72×72)

### For Team Roping App, Consider:

- Rope/lasso silhouette
- Cowboy hat
- Horse head silhouette
- Letters "RR" (Round Robin)
- Western/rodeo theme
- Colors: Blue (#2563eb) matches the app theme

## How to Add Your Icons

### Option 1: Use the Icon Generator (Quick & Easy)

1. Open `create-icons.html` in your browser
2. It will generate basic placeholder icons
3. Right-click each icon and "Save image as..."
4. Save to `icons/` folder with correct names

### Option 2: Use an Online Tool (Recommended)

**PWA Builder** (easiest):
1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload a 512×512 source image
3. Click "Generate"
4. Download the zip file
5. Extract all icons to the `icons/` folder

**Real Favicon Generator**:
1. Go to https://realfavicongenerator.net/
2. Upload your icon
3. Generate all sizes
4. Download and extract to `icons/` folder

### Option 3: Create Your Own

1. Design in Figma/Canva/Photoshop/etc.
2. Export at each required size:
   - 72×72, 96×96, 128×128, 144×144
   - 152×152, 192×192, 384×384, 512×512
3. Save as PNG with transparency (recommended)
4. Name them correctly (icon-72.png, icon-96.png, etc.)
5. Place in `icons/` folder

## Quick Start: Minimum Icons Needed

If you're in a hurry, you can start with just these 3 icons:

1. **icon-192.png** - Most important, used everywhere
2. **icon-512.png** - For high-res displays and splash screens
3. **icon-72.png** - For older devices

Then add the others later for full compatibility.

## Testing Your Icons

### 1. Check in Browser
- Restart your local server
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check the browser tab - should show your icon

### 2. Check in DevTools
- F12 → Application → Manifest
- Scroll down to "Icons" section
- Should show all 8 icons with checkmarks

### 3. Test Installation
- Click install button in address bar
- Install the app
- Check home screen - should show your icon

### 4. View Icon Preview
```bash
# Open the icons folder
open icons/
# or on Windows
explorer icons\
```

## Current Icon Setup

Right now, the app is configured to look for icons, but the files don't exist yet. The app will work fine without icons, but:

- Browser tab will show a default icon
- PWA installation will show a placeholder
- Some browsers won't offer to install without icons

## Icon File Formats

- **PNG** - Recommended (supports transparency)
- **SVG** - Not widely supported for PWA icons yet
- **JPG** - Works but no transparency
- **WebP** - Limited support

Stick with PNG for best compatibility.

## Troubleshooting

### Icons Not Showing?
1. Check filenames match exactly (case-sensitive)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Unregister Service Worker and reload
4. Check file paths in DevTools Console

### Icons Look Blurry?
- Make sure each icon is the exact size required
- Don't upscale small images
- Start with 512×512 and downscale

### Can't Install PWA?
- Icons are required for installation
- At minimum, need 192×192 and 512×512
- Check manifest.json loads correctly

## Example Icon Structure

Once you add your icons, your folder should look like this:

```
icons/
├── README.txt
├── icon-72.png      ✓ 72×72 pixels
├── icon-96.png      ✓ 96×96 pixels
├── icon-128.png     ✓ 128×128 pixels
├── icon-144.png     ✓ 144×144 pixels
├── icon-152.png     ✓ 152×152 pixels
├── icon-192.png     ✓ 192×192 pixels (MOST IMPORTANT)
├── icon-384.png     ✓ 384×384 pixels
└── icon-512.png     ✓ 512×512 pixels (IMPORTANT)
```

## Summary

**What you need to do**:
1. Create or download 8 PNG icons at the specified sizes
2. Name them: icon-72.png through icon-512.png
3. Place them in the `icons/` folder
4. Reload the app

**Files are already configured** in:
- `index.html` (lines 14-15)
- `manifest.json` (lines 10-58)

You just need to add the actual PNG files!
