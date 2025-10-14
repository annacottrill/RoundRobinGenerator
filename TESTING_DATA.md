# Testing Data

Use this sample data to quickly populate your app for testing.

## Sample Ropers to Add

### Headers
1. **Jake Thompson** - Header - Skill: 8
2. **Mike Rodriguez** - Header - Skill: 7
3. **Chris Baker** - Header - Skill: 9
4. **Tom Wilson** - Header - Skill: 6

### Heelers
1. **Sarah Martinez** - Heeler - Skill: 8
2. **David Lee** - Heeler - Skill: 7
3. **Ryan Cooper** - Heeler - Skill: 9
4. **Alex Johnson** - Heeler - Skill: 6

### Both Positions
1. **Jordan Smith** - Both - Skill: 8
2. **Casey Brown** - Both - Skill: 7

## Sample Event

**Event Name**: Spring Classic 2025
**Date**: Today's date
**Participants**: Select all ropers

This will generate 20+ team pairings.

## Sample Times (in seconds)

Use these realistic team roping times for testing:

- Fast teams: 5.2 - 6.5
- Average teams: 6.6 - 8.5
- Slower teams: 8.6 - 11.0
- Penalty (missed catch): Add 5.0 to time

### Example Times for First 10 Teams
1. 5.43
2. 6.12
3. 7.85
4. 5.89
5. 8.21
6. 6.54
7. 9.12
8. 7.03
9. 6.88
10. 10.25

## Quick Test Script

You can also copy/paste this into the browser console to quickly add test data:

```javascript
// Add sample ropers
async function addTestRopers() {
    const ropers = [
        { name: "Jake Thompson", position: "header", skillLevel: 8 },
        { name: "Mike Rodriguez", position: "header", skillLevel: 7 },
        { name: "Chris Baker", position: "header", skillLevel: 9 },
        { name: "Sarah Martinez", position: "heeler", skillLevel: 8 },
        { name: "David Lee", position: "heeler", skillLevel: 7 },
        { name: "Ryan Cooper", position: "heeler", skillLevel: 9 },
        { name: "Jordan Smith", position: "both", skillLevel: 8 },
        { name: "Casey Brown", position: "both", skillLevel: 7 }
    ];

    for (const roper of ropers) {
        await dbHelpers.addRoper(roper);
    }

    console.log('Added', ropers.length, 'test ropers');
}

// Run it:
addTestRopers();
```

## Testing Checklist

### Basic Functionality
- [ ] Add a roper
- [ ] Edit a roper
- [ ] Delete a roper
- [ ] Create an event with 2+ ropers
- [ ] View generated pairings
- [ ] Record a time
- [ ] Edit a recorded time
- [ ] View results/standings

### PWA Features
- [ ] Install app to home screen
- [ ] Open installed app (standalone mode)
- [ ] Test offline mode (DevTools → Network → Offline)
- [ ] Check online/offline indicator updates

### Mobile Testing
- [ ] Responsive layout on small screens
- [ ] Navigation menu scrolls horizontally
- [ ] Forms are usable on mobile
- [ ] Touch interactions work

### Edge Cases
- [ ] Try to create event with no ropers selected
- [ ] Try to create event with only headers (no heelers)
- [ ] Try to record invalid time (negative, text)
- [ ] View results with no completed runs
- [ ] Add roper with same name (should allow duplicates)

### Data Persistence
- [ ] Add data, close browser, reopen → data still there
- [ ] Clear browser data → app resets
- [ ] Multiple events don't interfere with each other

### Browser Compatibility
- [ ] Test in Chrome/Edge
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test on mobile device

## Expected Behavior

### Round Robin Pairing Logic
- With 3 headers and 3 heelers = 9 pairings
- With 4 headers and 4 heelers = 16 pairings
- Each header ropes with each heeler exactly once
- Ropers marked as "Both" appear in both lists

### Results Sorting
- Sorted by time (fastest first)
- Top 3 get medal badges (gold, silver, bronze)
- Only completed runs are shown
- No time (NT) runs don't appear in standings

### Statistics
- Total teams = number of pairings
- Completed = runs with recorded times
- Pending = runs without times
- Average = mean of all completed times

## Performance Benchmarks

Expected performance on average hardware:

- Add 10 ropers: < 1 second
- Generate event with 50 pairings: < 2 seconds
- Display results page: < 500ms
- Navigate between pages: < 100ms
- Offline mode: All features work instantly

## Known Issues / Limitations

1. Edit dialogs use browser `prompt()` (simple but not elegant)
2. No data validation on skill level (can enter 100)
3. Can't delete events (feature not implemented)
4. No undo functionality
5. Icons need to be generated manually
6. Dates default to browser locale format

## Reporting Issues

If you find bugs or issues:
1. Check browser console for errors (F12)
2. Note the browser and version
3. Describe the steps to reproduce
4. Check if it happens in incognito mode
