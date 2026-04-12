# Old UI API Usage Map

This file documents how the legacy frontend in `old data/` used the embedded GET API.

## Startup sequence (automatic)

1. `GET /OnGoing`
- Trigger: immediately when `data_query.js` loads (`isProtocolOngoing()`).
- Purpose: detect if an experiment is already running.

2. `GET /cycle_time`
- Trigger: inside `isProtocolOngoing()` after `/OnGoing` response.
- Purpose: initialize cycle period input and polling interval.

3. `GET /weights`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: populate weights table.

4. `GET /lid_temp`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize lid temperature setting.

5. `GET /lid_diff`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize lid temperature delta setting.

6. `GET /melting_step`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize melting step.

7. `GET /melting_time`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize melting step duration.

8. `GET /melting_range`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize melting range sliders.

9. `GET /free_memory`
- Trigger: inside `isProtocolOngoing()`.
- Purpose: initialize memory usage bar.

10. `GET /protocols`
- Trigger: `window.onload` in `functions.js`.
- Purpose: load protocol library list.

11. `GET /device-config`
- Trigger: `DOMContentLoaded` in `index.html`.
- Purpose: populate device config bar (`ip`, `mdns`, `ssid`, `password`).

## Run control

1. `GET /manual_cycle`
- Trigger: click `#cycle` button.
- Follow-up: after ~3s, `updateData()` is called.

2. `GET /Run?degrees=<target>`
- Trigger: click `#temp` when button text is `Run`.
- Follow-up: on `[OK]`, starts `setInterval(updateData, CYCLE_TIME)`.

3. `GET /RunMelting`
- Trigger: click `#temp` when button text is `Run Melting Curve`.
- Follow-up: on `[OK]`, starts `setInterval(updateData, CYCLE_TIME)`.

4. `GET /Stop`
- Trigger: click `#temp` when button text is `Stop`.
- Follow-up: polling interval cleared.

## Data polling

1. `GET /data_request`
- Trigger: `updateData(false)` during active run.
- Timing: periodic interval (`CYCLE_TIME`).

2. `GET /last_run_request`
- Trigger: `updateData(true)` from `#last_run_load` click.

## Calibration signal flow (button `#calibrate_signal`)

1. `GET /ReadFluo`
- Trigger: calibration flow start.

2. `GET /fluo`
- Trigger: after ~10s delay post `/ReadFluo`.

3. `GET /Calibration`
- Trigger: after initial fluorescence is read.

4. `GET /readWeights`
- Trigger: after ~60s delay.

5. `GET /ReadFluo`
- Trigger: second pass after weights.

6. `GET /fluo`
- Trigger: after ~10s delay in second pass.

## Settings updates (UI button actions)

1. `GET /cycle_time?set=<ms>`
- Trigger: click `#cycle-time-set`.

2. `GET /lid_temp?set=<temp>`
- Trigger: click `#lid-temp-set`.

3. `GET /lid_diff?set=<delta>`
- Trigger: click `#lid-diff-set`.

4. `GET /step_temp?set=<temp>`
- Trigger: one `set_step_temp` implementation.
- Note: overridden by a later function with same name.

5. `GET /melting_step?set=<temp>`
- Trigger: effective `set_step_temp` implementation used at runtime.

6. `GET /melting_time?set=<ms>`
- Trigger: click `#melting-step-time-set`.

7. `GET /melting_range?set=<left,right>`
- Trigger: click `#melting-range-set`.

## Protocol management

1. `GET /protocols`
- Trigger: load protocol library on startup.

2. `GET /protocols?save_new=1&name=<name>&protocol_data=<json>`
- Trigger: click `#save-protocol`.

3. `GET /protocols?delete=1&name=<name>`
- Trigger: click delete icon in protocol list.

## Notes for migration

- The old UI uses GET for both reads and writes.
- Several writes are query-string based (`?set=...`).
- The runtime `set_step_temp` symbol is duplicated; the second definition (using `/melting_step`) wins in browser execution.
