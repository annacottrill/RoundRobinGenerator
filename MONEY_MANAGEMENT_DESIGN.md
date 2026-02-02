# Money Management Design Options

## Current Status
Money management feature is implemented but hidden from UI pending decision on stock fee allocation method.

## Background
The money management system needs to handle separate pots for headers and heelers since different numbers of each position may enter an event.

## Stock Fee Allocation Options

### Example Scenario
- 2 Headers enter @ $150 each = $300 header collections
- 3 Heelers enter @ $150 each = $450 heeler collections
- Total Collections: $750
- Stock Fee: 25% = $187.50

### Option A: Proportional Stock Fee Split
Stock fee is split proportionally based on each side's contribution to total collections.

**Calculation:**
```
Total Stock Fee: $750 × 25% = $187.50

Header Stock Fee: $187.50 × ($300 / $750) = $187.50 × 0.40 = $75.00
Heeler Stock Fee: $187.50 × ($450 / $750) = $187.50 × 0.60 = $112.50

Header Pot (after stock): $300 - $75 = $225
Heeler Pot (after stock): $450 - $112.50 = $337.50
```

**Payout Example (40/30/20/10%):**
- Header 1st: 40% of $225 = $90.00
- Header 2nd: 30% of $225 = $67.50
- Header 3rd: 20% of $225 = $45.00
- Header 4th: 10% of $225 = $22.50

- Heeler 1st: 40% of $337.50 = $135.00
- Heeler 2nd: 30% of $337.50 = $101.25
- Heeler 3rd: 20% of $337.50 = $67.50
- Heeler 4th: 10% of $337.50 = $33.75

**Pros:**
- Fair - each side pays stock proportional to what they contributed
- More money collected = more stock paid
- Mathematically balanced

**Cons:**
- Slightly more complex calculation
- Headers and heelers pay different stock amounts

### Option B: Equal (50/50) Stock Fee Split
Stock fee is split evenly between headers and heelers regardless of how many enter.

**Calculation:**
```
Total Stock Fee: $750 × 25% = $187.50

Header Stock Fee: $187.50 / 2 = $93.75
Heeler Stock Fee: $187.50 / 2 = $93.75

Header Pot (after stock): $300 - $93.75 = $206.25
Heeler Pot (after stock): $450 - $93.75 = $356.25
```

**Payout Example (40/30/20/10%):**
- Header 1st: 40% of $206.25 = $82.50
- Header 2nd: 30% of $206.25 = $61.88
- Header 3rd: 20% of $206.25 = $41.25
- Header 4th: 10% of $206.25 = $20.63

- Heeler 1st: 40% of $356.25 = $142.50
- Heeler 2nd: 30% of $356.25 = $106.88
- Heeler 3rd: 20% of $356.25 = $71.25
- Heeler 4th: 10% of $356.25 = $35.63

**Pros:**
- Simple - always split stock fee in half
- Traditional team event approach
- Easy to explain

**Cons:**
- If one side has significantly more entries, they pay proportionally less stock
- Could be seen as unfair in unbalanced events

### Option C: No Stock Fee Split (Combined Pot)
Calculate stock fee from total, then split the remaining pot 50/50 between headers and heelers.

**Calculation:**
```
Total Stock Fee: $750 × 25% = $187.50
Remaining Pot: $750 - $187.50 = $562.50

Header Pot: $562.50 / 2 = $281.25
Heeler Pot: $562.50 / 2 = $281.25
```

**Pros:**
- Guaranteed equal pots for headers and heelers
- Very simple

**Cons:**
- Ignores actual contributions from each side
- Side with fewer entries gets better per-person return
- Not ideal for unbalanced events

## Implementation Details

### Current Code Structure
- Toggle for enabling/disabling money management
- Entry fee per person
- Stock fee percentage
- Places to pay (dynamic)
- Payout type toggle ($ or %)
- Separate payout fields for headers and heelers

### Code Changes Needed for Each Option

**Option A (Proportional):**
```javascript
const headerCollections = entryFee * selectedHeaders;
const heelerCollections = entryFee * selectedHeelers;
const totalCollections = headerCollections + heelerCollections;
const totalStockFee = totalCollections * (stockFeePercent / 100);

const headerStockFee = totalStockFee * (headerCollections / totalCollections);
const heelerStockFee = totalStockFee * (heelerCollections / totalCollections);

const headerPot = headerCollections - headerStockFee;
const heelerPot = heelerCollections - heelerStockFee;
```

**Option B (50/50):**
```javascript
const headerCollections = entryFee * selectedHeaders;
const heelerCollections = entryFee * selectedHeelers;
const totalCollections = headerCollections + heelerCollections;
const totalStockFee = totalCollections * (stockFeePercent / 100);

const headerStockFee = totalStockFee / 2;
const heelerStockFee = totalStockFee / 2;

const headerPot = headerCollections - headerStockFee;
const heelerPot = heelerCollections - heelerStockFee;
```

**Option C (Combined Pot Split):**
```javascript
const totalCollections = entryFee * totalParticipants;
const totalStockFee = totalCollections * (stockFeePercent / 100);
const remainingPot = totalCollections - totalStockFee;

const headerPot = remainingPot / 2;
const heelerPot = remainingPot / 2;
```

## Questions to Ask Ropers

1. How is stock fee typically handled at your events?
2. When there are unequal numbers of headers vs heelers, how is the money split?
3. Do headers and heelers get paid from separate pots or one combined pot?
4. Is stock fee taken as a percentage of total collections or split differently?

## Next Steps

1. Consult with experienced ropers/event organizers
2. Determine industry standard or preferred method
3. Implement chosen option
4. Add display to show:
   - Header pot amount
   - Heeler pot amount
   - Header stock fee
   - Heeler stock fee
   - Breakdown of how stock was allocated
5. Un-hide money management section in UI
