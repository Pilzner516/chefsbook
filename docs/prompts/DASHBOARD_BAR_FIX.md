# Mission: Fix metric bar legibility in LuxLabs Dashboard

## Problem
The CPU, RAM, and Disk gauge bars have white/light text overlapping with the green bar fill,
making the values (e.g. "12.4%", "2048MB / 16384MB") illegible when the bar is filled.

## File to edit
/home/pilzner/luxlabs-dashboard/public/index.html

## Fix
The metric value text and the bar track are stacked vertically — the text is ABOVE the bar,
not inside it. The issue is likely that zoom scaling caused layout shifts, or the bar fill
color is bleeding through. 

Do the following:

1. Read the file and find the `.metric`, `.metric-row`, `.metric-value`, `.bar-track`,
   and `.bar-fill` CSS rules.

2. Ensure the metric value text is clearly separated from the bar by:
   - Setting `.metric-value` to have `display: block` and adequate `margin-bottom`
   - Making sure `.bar-track` has `margin-top: 4px` 
   - Adding `text-shadow: 0 1px 4px rgba(0,0,0,1)` to `.metric-value` so text is
     always readable regardless of background
   - Setting explicit `color: var(--text)` on `.metric-value` base class

3. For the colored variants (.metric-value.bright, .metric-value.warn, .metric-value.crit),
   ensure they keep their colors but also have the text-shadow for legibility.

4. Make sure the bar fill (`bar-fill`) has `overflow: hidden` and does NOT extend
   above the bar-track container.

5. Use Python to make the edits (sed is unreliable in this environment):
   ```
   python3 -c "..."
   ```

6. Restart the kiosk to apply:
   ```
   sudo systemctl restart luxlabs-kiosk
   ```

7. Also verify with curl that the server still responds:
   ```
   curl -s http://localhost:9000/api/system | python3 -m json.tool | head -5
   ```

## Done When
- CPU, RAM, and Disk percentage text is clearly readable against any bar fill level
- Bar fills still animate correctly (green → amber → red based on thresholds)
- No layout breakage in other panels
- Kiosk restarted and displaying correctly
