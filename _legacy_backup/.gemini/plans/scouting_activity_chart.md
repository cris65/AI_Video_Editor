# 🔍 Scouting Report: Activity Analysis Chart Pollution

## 1. The Component
The component rendering the "Activity Analysis" chart is perfectly isolated at:
`frontend/src/components/projects/analytics/ActivityChart.tsx`

This component uses the `recharts` library (`LineChart`, `Line`, `CustomTooltip`, `CustomMixDot`) to draw the total hours spent across projects.

## 2. The Data Aggregation Flaw
Starting at line 174 inside the main `useMemo`, the chart prepares the `validEntries` subset from the raw `entries` prop:

```typescript
        // 0. Filter entries mathematically strictly inside the effective timeframe
        const effectiveStartTs = effectiveStart.getTime();
        const effectiveEndTs = effectiveEnd.getTime();
        
        const validEntries = entries.filter(e => {
            if (!e.start_time) return false;
            const t = Date.parse(e.start_time);
            if (isNaN(t)) return false;
            return t >= effectiveStartTs && t <= effectiveEndTs;
        });
```

**The Logic Flaw:**
The filter strictly checks chronological bounds (`effectiveStartTs` and `effectiveEndTs`), but completely ignores the entity's state. It fails to filter out `e.is_done === false` ( Planned Forecasts ) and `e.is_recurring_ghost === true` ( Virtual RRULE extrapolations ).
Because of this, the subsequent map loops blindly accumulate all `(e.duration || 0) / 3600` into `totalDuration` and `dayData[key]`, directly inflating the historical metrics with future/hypothetical projections.

## 3. The Mathematical Fix
Because the "Activity Analysis" chart is historically oriented (rendering YTD, past weeks/months), it must strictly calculate **Actuals** and discard purely **Planned** projections to prevent ghost data inflation.

The fix must be applied sequentially inside the `validEntries` array filter logic:

```typescript
        const validEntries = entries.filter(e => {
            // 1. Filter out Forecasts and Ghost Entities
            if (e.is_done === false) return false;
            if ((e as any).is_recurring_ghost) return false;
            
            // 2. Filter Mathematical Bounds
            if (!e.start_time) return false;
            const t = Date.parse(e.start_time);
            if (isNaN(t)) return false;
            return t >= effectiveStartTs && t <= effectiveEndTs;
        });
```

By safely destroying uncompleted/forecasted data right at the gate inside `validEntries`, both the Daily (`eachDayOfInterval`) and Weekly (`eachWeekOfInterval`) charting loops will inherently render pristine numbers across `totalDuration` and the custom Project line configs, ensuring mathematical consistency with the Global Stats aggregators.
