# RT-LAMP Device API Documentation

## Overview
This API allows remote control and monitoring of an RT-LAMP thermal cycling device via HTTP requests. The device runs a web server that exposes various endpoints for experiment control, temperature management, fluorescence reading, and configuration.

## Connection

### Base URL
- **IP Address**: `http://<device-ip>/`
- **mDNS**: `http://<device-mdns>.local/`

The device IP and mDNS name are printed to serial console on successful WiFi connection. By default this is: http://qbyte.local. In case mDNS do not work you can use the IP address assigned to the device as a safe fallback option.

If the device do not find the local network it was configured to connect to, it will create a WiFi Access Point named "qByte-Setup". You can connect to this AP and access the configuration portal at http://qbyte.local or http://192.168.4.1. In wuch a portal you can configure a new wifi network for the device to connect to. You can also do this via serial commands, sending 'wifi "ssid" "password"' (with " included) via a serial terminal working at 115200 baud rate.

Remember that the USB serial wire connected to a laptop is only required for initial configuration. Once the device is connected to a WiFi network, all interactions should be done wirelessly and the device should be powered by its USB-C 12V charger.

### Authentication
Currently, no authentication is required.

---

## API Endpoints

### 1. Device Status & Information

#### GET `/OnGoing`
Check if an experiment is currently running.

**Response:**
- `1` - Experiment is running
- `0` - No experiment running

**Example:**
```bash
GET http://device-ip/OnGoing
```

---

#### GET `/free_memory`
Get available SPIFFS storage space percentage (this is used to store the current protocol data and is erased once a new protocol starts).

**Response:**
- Text: Percentage of free SPIFFS space

**Example:**
```bash
GET http://device-ip/free_memory
```

---

### 2. Temperature Control

#### GET `/temp`
Get current temperature of WELL1 (which is supposed to be a proxy of all wells).

**Response:**
- Text: Temperature value with 4 decimal places (e.g., `25.1234`)

**Example:**
```bash
GET http://device-ip/temp
```

---

#### GET `/new_temp?degrees=<value>`
Set new target temperature for the heating wells.

**Parameters:**
- `degrees` (required): Target temperature in Celsius (0-100°C)

**Response:**
- Success: `TARGET TEMPERATURE SET TO <value>ºC`
- Error: `[ERROR] TEMPERATURE NOT IN RANGE [0ºC-100ºC]`
- Error: `[ERROR] TARGET TEMPERATURE REQUIRED`

**Example:**
```bash
GET http://device-ip/new_temp?degrees=65
```

---

#### GET `/lid_temp`
Get or set lid temperature.

**Parameters:**
- `set` (optional): New lid temperature in Celsius

**Response:**
- Without `set`: Current lid temperature
- With `set`: `[OK] LID TEMPERATURE CHANGED TO <value>ºC`

**Examples:**
```bash
# Get current lid temperature
GET http://device-ip/lid_temp

# Set lid temperature to 105°C
GET http://device-ip/lid_temp?set=105
```

---

#### GET `/lid_diff`
Get or set lid temperature difference threshold.

**Parameters:**
- `set` (optional): New lid temperature difference value in Celsius

**Response:**
- Without `set`: Current lid temperature difference
- With `set`: `[OK] LID TEMPERATURE DIFFERENCE CHANGED TO <value>ºC`

**Examples:**
```bash
# Get current difference
GET http://device-ip/lid_diff

# Set difference to 5°C
GET http://device-ip/lid_diff?set=5
```

---

### 3. Protocol Execution

#### GET `/Run?degrees=<value>`
Start a new thermal cycling protocol at specified temperature.

**Parameters:**
- `degrees` (required): Target temperature in Celsius

**Response:**
- Success: `[OK] STARTING NEW PROTOCOL AT <value>ºC`
- Error: `[ERROR] TARGET TEMPERATURE REQUIRED`

**Side Effects:**
- Resets all variable gains to 0
- Creates/overwrites `/last_run.txt` file
- Sets `OnGoing` flag to true

**Example:**
```bash
GET http://device-ip/Run?degrees=65
```

---

#### GET `/RunMelting`
Start a melting curve analysis protocol.

**Response:**
- `[OK] STARTING NEW MELTING CURVE`

**Side Effects:**
- Creates/overwrites `/last_run.txt` file
- Sets `OnGoing` and `OnGoingMelting` flags to true
- Uses temperature range from `melting_range` configuration

**Example:**
```bash
GET http://device-ip/RunMelting
```

---

#### GET `/Stop`
Stop the currently running protocol.

**Response:**
- `[OK] STOPPING PROTOCOL`

**Side Effects:**
- Sets target temperature to 0
- Writes "stop" to `/last_run.txt`
- Clears `OnGoing` flag

**Example:**
```bash
GET http://device-ip/Stop
```

---

#### GET `/manual_cycle`
Force an immediate thermal cycle and fluorescence reading, bypassing the normal cycle time interval. This is useful when you want to take a reading immediately without waiting for the scheduled cycle time.

**Response:**
- Success: `[OK] STARTING MANUAL CYCLE`
- Error: `[ERROR] PROTOCOL NOT RUNNING`

**Side Effects:**
- Triggers an immediate cycle regardless of cycle_time setting
- Automatically performs fluorescence reading as part of the cycle
**Example:**
```bash
GET http://device-ip/manual_cycle
```

---

### 4. Fluorescence Reading

#### GET `/ReadFluo`
Request a fluorescence measurement to be taken. This sets a flag that tells the device to perform a fluorescence reading on the next sensor update cycle. Use this when you want to take a standalone fluorescence measurement without running a full protocol cycle.

**Response:**
- `[OK] READING FLUORESCENCE`

**Side Effects:**
- Sets `reading_fluorescence` flag to true
- Device will perform the reading asynchronously on next sensor update

**Note:** This is different from `/manual_cycle` which triggers a full thermal cycle. Use `/ReadFluo` for quick fluorescence checks without re running the PID. In reality, both are quite equivalent and just differ slightly in timing, which is useful for debug. Normally use the manual_cycle as for protocol runs is safer.

**Example:**
```bash
GET http://device-ip/ReadFluo
```

---

#### GET `/fluo`
Retrieve the most recent fluorescence measurement values from all 8 channels. This returns cached data from the last reading (triggered by either `/ReadFluo`, `/manual_cycle`, or automatic cycle during a running protocol).

**Response:**
- Text: Comma-separated fluorescence values for all 8 channels

**Note:** This endpoint only retrieves stored values - it does not trigger a new reading. Call `/ReadFluo` first if you need fresh data.

**Example:**
```bash
# Workflow: Request reading, wait briefly, then retrieve values
GET http://device-ip/ReadFluo
# Wait ~1-2 seconds for reading to complete
GET http://device-ip/fluo
# Response example: 1234.5,2345.6,3456.7,4567.8,5678.9,6789.0,7890.1,8901.2
```

---

### 5. Calibration

#### GET `/Calibration`
Start calibration procedure.

**Response:**
- `[OK] CALIBRATION STARTED`

**Side Effects:**
- Sets `calibrate` flag to true
- Calibration may take approximately 1 minute

**Example:**
```bash
GET http://device-ip/Calibration
```

---

#### GET `/readWeights`
Get calibration weight values.

**Response:**
- Text: Comma-separated list of 8 weight values

**Example:**
```bash
GET http://device-ip/readWeights
# Response: 1.234,5.678,9.012,3.456,7.890,1.234,5.678,9.012
```

---

#### GET `/weights`
Get calibration weight values (alternative endpoint).

**Response:**
- Text: Comma-separated list of 8 weight values

**Example:**
```bash
GET http://device-ip/weights
```

---

### 6. Data Retrieval

#### GET `/data_request`
Get current experiment data.

**Response:**
- Success: Contents of `/last_run.txt` file
- Error: `[ERROR] NO PROTOCOL RUNNING` (if no protocol is running and last one already retrieved)

**Example:**
```bash
GET http://device-ip/data_request
```

---

#### GET `/last_run_request`
Get data from the last completed run.

**Response:**
- Contents of `/last_run.txt` file

**Example:**
```bash
GET http://device-ip/last_run_request
```

---

### 7. Configuration Parameters

#### GET `/cycle_time`
Get or set cycle time in milliseconds.

**Parameters:**
- `set` (optional): New cycle time in milliseconds

**Response:**
- Without `set`: Current cycle time value
- With `set`: `[OK] CYCLE TIME CHANGED TO <value>ms`

**Examples:**
```bash
# Get current cycle time
GET http://device-ip/cycle_time

# Set cycle time to 30000ms (30 seconds)
GET http://device-ip/cycle_time?set=30000
```

---

#### GET `/melting_step`
Get or set temperature step for melting curve.

**Parameters:**
- `set` (optional): New melting step in Celsius

**Response:**
- Without `set`: Current melting step value
- With `set`: `[OK] MELTING STEP CHANGED TO <value>ºC`

**Examples:**
```bash
# Get current melting step
GET http://device-ip/melting_step

# Set melting step to 0.5°C
GET http://device-ip/melting_step?set=0.5
```

---

#### GET `/melting_time`
Get or set time per step for melting curve.

**Parameters:**
- `set` (optional): New melting time in milliseconds

**Response:**
- Without `set`: Current melting time value
- With `set`: `[OK] MELTING TIME CHANGED TO <value>ms`

**Examples:**
```bash
# Get current melting time
GET http://device-ip/melting_time

# Set melting time to 5000ms
GET http://device-ip/melting_time?set=5000
```

---

#### GET `/melting_range`
Get or set temperature range for melting curve [start, end].

**Parameters:**
- `set` (optional): New melting range as "start,end" (e.g., "60,95")

**Response:**
- Without `set`: Current range as "start,end"
- With `set`: `[OK] MELTING RANGE CHANGED TO <range>ºC`

**Examples:**
```bash
# Get current melting range
GET http://device-ip/melting_range
# Response: 60,95

# Set melting range from 60°C to 95°C
GET http://device-ip/melting_range?set=60,95
```

---

### 8. Protocol Library Management

#### GET `/protocols`
Retrieve all saved protocols.

**Response:**
- JSON object containing all saved protocols

**Example:**
```bash
GET http://device-ip/protocols
```

---

#### GET `/protocols?save_new=1&name=<protocol_name>&protocol_data=<json_data>`
Save a new protocol to the library.

**Parameters:**
- `save_new`: Must be set to `1`
- `name` (required): Protocol name
- `protocol_data` (required): JSON-encoded protocol data

**Response:**
- Success: `[OK] Protocol saved successfully`
- Error: `[ERROR] Invalid protocol data format`
- Error: `[ERROR] Protocol name is required`
- Error: `[ERROR] Failed to open protocols file for writing`

**Example:**
```bash
GET http://device-ip/protocols?save_new=1&name=MyProtocol&protocol_data={"temp":65,"cycles":40}
```

---

#### GET `/protocols?delete=1&name=<protocol_name>`
Delete a protocol from the library.

**Parameters:**
- `delete`: Must be set to `1`
- `name` (required): Protocol name to delete

**Response:**
- Success: `[OK] Protocol deleted successfully`
- Error: `[ERROR] Protocol not found`
- Error: `[ERROR] Failed to parse existing protocols`

**Example:**
```bash
GET http://device-ip/protocols?delete=1&name=MyProtocol
```

---

### 9. Diagnostics

#### GET `/res`
Get resistance measurement.

**Response:**
- Text: Resistance value

**Example:**
```bash
GET http://device-ip/res
```

---

#### GET `/variable_gains`
Get variable gain values for all 8 channels.

**Response:**
- Text: Comma-separated list of 8 gain values

**Example:**
```bash
GET http://device-ip/variable_gains
# Response: 0,0,0,0,0,0,0,0
```

---

#### GET `/led_trial`
Test LED functionality (cycles through all 8 LEDs).

**Response:**
- `ok`

**Side Effects:**
- Sequentially turns on each LED for 500ms

**Example:**
```bash
GET http://device-ip/led_trial
```

---

### 10. Device Configuration and Updates

#### GET `/device-config`
Read the device IP address, mDNS name, Wi-Fi SSID, and saved interface theme. The saved Wi-Fi password is never returned.

**Response:** JSON with `ip`, `mdns`, `ssid`, and `theme` fields.

#### GET `/device-config?theme=<theme>`
Save the interface theme without restarting the device. Supported values are `tokyo-night`, `catppuccin`, `nord`, and `sunset`.

#### GET `/device-config?save=1&mdns=<name>&ssid=<ssid>&password=<password>`
Save Wi-Fi and mDNS settings and restart the device.

Send `mdns`, `ssid`, and `password` as query parameters. Leave `password` empty to keep the existing password.

```bash
curl 'http://device-ip/device-config?save=1&mdns=qbyte&ssid=my-network&password=my-secret'
```

#### GET `/firmware-update`
Read the installed firmware version and update state.

**Response:** JSON with `version`, `manifest`, `updating`, and `experiment_running` fields.

#### GET `/firmware-update?start=1`
Start a firmware and web-interface update from the GitHub manifest. The device must have internet access and no experiment may be running. The endpoint returns `202` and the update continues after the response is sent.

```bash
curl 'http://device-ip/firmware-update?start=1'
```

The manifest URL used by the current firmware is:
`https://qbyte.daicochiti.xyz/update_server/data/fota.json`

---

## Common Workflows

### Starting an Experiment
```bash
# 1. Check if device is ready
GET http://device-ip/OnGoing
# Should return: 0

# 2. Set desired temperature and start protocol
GET http://device-ip/Run?degrees=65

# 3. Monitor progress
GET http://device-ip/data_request
```

### Running a Melting Curve
```bash
# 1. Configure melting parameters (optional)
GET http://device-ip/melting_range?set=60,95
GET http://device-ip/melting_step?set=0.5
GET http://device-ip/melting_time?set=5000

# 2. Start melting curve
GET http://device-ip/RunMelting

# 3. Monitor progress
GET http://device-ip/data_request
```

### Stopping an Experiment
```bash
GET http://device-ip/Stop
```

### Reading Temperature and Fluorescence
```bash
# Get current temperature
GET http://device-ip/temp

# Trigger fluorescence reading
GET http://device-ip/ReadFluo

# Wait a moment, then retrieve values
GET http://device-ip/fluo
```

---

## Notes

1. **All endpoints use HTTP GET requests.** Writes use query parameters because this firmware's legacy AsyncWebServer stack does not reliably process request bodies.
2. **Configuration changes are persisted** - Settings like cycle_time, lid_temp, melting parameters are saved to device storage
3. **Protocol data is stored in SPIFFS** - The `/last_run.txt` file contains experiment data
4. **No concurrent experiments** - Only one protocol can run at a time
5. **Response format** - Most responses are plain text, protocol library uses JSON format but sent in plain text
6. **Temperature units** - All temperatures are in Celsius
7. **Time units** - Cycle and melting times are in milliseconds

---

## Error Handling

The API returns HTTP 200 status for most requests, with error messages in the response body starting with `[ERROR]`. Success messages start with `[OK]`.

Common error patterns:
- Missing required parameters: `[ERROR] TARGET TEMPERATURE REQUIRED`
- Invalid ranges: `[ERROR] TEMPERATURE NOT IN RANGE [0ºC-100ºC]`
- Invalid state: `[ERROR] NO PROTOCOL RUNNING`
- File system errors: `[ERROR] Failed to open protocols file for writing`

---
