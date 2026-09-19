// AP Mode implementation for qByte device
// This file handles the Access Point mode when WiFi connection fails

// AP mode settings
const char* ap_ssid = "qByte-Setup";
const char* ap_password = "";  // Empty for open network
bool ap_mode_active = false;

// HTML for the configuration page (stored as a string to avoid SPIFFS dependency)
const char* config_html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <title>qByte WiFi Setup</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 8px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    .networks {
      margin-bottom: 15px;
    }
    select {
      width: 100%;
      padding: 8px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>qByte WiFi Setup</h1>
    <form action="/save-wifi" method="GET">
      <div class="networks">
        <label for="network-list">Available Networks:</label>
        <select id="network-list" onchange="updateSSID()">
          <option value="">Scanning...</option>
        </select>
      </div>
      <div>
        <label for="ssid">WiFi Name (SSID):</label>
        <input type="text" id="ssid" name="ssid" required>
      </div>
      <div>
        <label for="password">WiFi Password:</label>
        <input type="password" id="password" name="password">
      </div>
        <div>
          <label for="mdns">Device Name (mDNS):</label>
          <input type="text" id="mdns" name="mdns" placeholder="e.g. qbyte-device" required>
        </div>
      <button type="submit">Save and Connect</button>
    </form>
  </div>

  <script>
    // Function to scan for WiFi networks
    function scanNetworks() {
      fetch('/scan-wifi')
        .then(response => response.json())
        .then(data => {
          const select = document.getElementById('network-list');
          select.innerHTML = '';
          
          if (data.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No networks found';
            select.appendChild(option);
            return;
          }
          
          // Add default option
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = '-- Select a network --';
          select.appendChild(defaultOption);
          
          // Add networks to select
          data.forEach(network => {
            const option = document.createElement('option');
            option.value = network;
            option.textContent = network;
            select.appendChild(option);
          });
        })
        .catch(error => {
          console.error('Error scanning networks:', error);
        });
    }
    
    // Function to update SSID field when network is selected
    function updateSSID() {
      const select = document.getElementById('network-list');
      const ssidInput = document.getElementById('ssid');
      ssidInput.value = select.value;
    }
    
    // Scan for networks when page loads
    window.onload = scanNetworks;
  </script>
</body>
</html>
)rawliteral";

// Function to start AP mode
void startAPMode() {
  if (ap_mode_active) return; // Already in AP mode
  
  Serial.println("[INFO] Starting Access Point mode");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_password);
  
  Serial.print("[INFO] AP IP address: ");
  Serial.println(WiFi.softAPIP());
  
  // Set up mDNS responder
  if (MDNS.begin(config.mDNS.c_str())) {
    Serial.println("[INFO] mDNS responder started. Device accessible at http://" + config.mDNS + ".local/");
    MDNS.addService("http", "tcp", 80);
  } else {
    Serial.println("[ERROR] Error setting up mDNS responder");
  }
  
  // Set up the web server routes for AP mode
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "text/html", config_html);
  });
  
  // Endpoint to scan for WiFi networks
  server.on("/scan-wifi", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "[";
    int n = WiFi.scanComplete();
    if (n == -2) {
      WiFi.scanNetworks(true); // Start async scan
      request->send(200, "application/json", "[]");
      return;
    }
    
    if (n > 0) {
      for (int i = 0; i < n; ++i) {
        if (i) json += ",";
        json += "\"" + WiFi.SSID(i) + "\"";
      }
      WiFi.scanDelete();
      if (WiFi.scanComplete() == -2) {
        WiFi.scanNetworks(true);
      }
    }
    json += "]";
    request->send(200, "application/json", json);
  });
  
  // Endpoint to save WiFi credentials
  server.on("/save-wifi", HTTP_GET, [](AsyncWebServerRequest *request) {
    String ssid = "";
    String password = "";
    String mdns = "";

    if (request->hasParam("ssid")) {
      ssid = request->getParam("ssid")->value();
    }
    if (request->hasParam("password")) {
      password = request->getParam("password")->value();
    }
    if (request->hasParam("mdns")) {
      mdns = request->getParam("mdns")->value();
    }

    if (ssid.length() > 0 && mdns.length() > 0) {
      // Save credentials and mDNS
      saveCredentials(ssid, password);
      config.mDNS = mdns;
      saveConfig();

      // Send success response with auto-redirect
      String response = "<html><head><meta http-equiv=\"refresh\" content=\"10;url=/\"></head><body>";
      response += "<h1>WiFi Credentials & mDNS Saved</h1>";
      response += "<p>The device will now restart and attempt to connect to your WiFi network.</p>";
      response += "<p>If connection is successful, you can access the device at:</p>";
      response += "<ul>";
      response += "<li>http://" + mdns + ".local/</li>";
      response += "<li>Or at the device's IP address (shown in serial monitor)</li>";
      response += "</ul>";
      response += "<p>The page will refresh in 10 seconds...</p>";
      response += "</body></html>";
      
      request->send(200, "text/html", response);
      
      // Schedule a restart after sending the response
      delay(500);
      ESP.restart();
    } else {
      request->send(400, "text/plain", "Invalid SSID or mDNS");
    }
  });
  
  server.on("/device-config", _device_config);
  
  // Start the server
  server.begin();
  
  ap_mode_active = true;
  Serial.println("[INFO] AP Mode web server started");
}// Modified connect_wifi function that falls back to AP mode
void connect_wifi_with_fallback(int time_trying) {
  Serial.println("\n");
  char** savedCredentials = loadCredentials();
  String ssid = savedCredentials[0];
  String password = savedCredentials[1];
  delete[] savedCredentials[0];
  delete[] savedCredentials[1];
  delete[] savedCredentials;

  // Check if credentials exist
  if (ssid.length() == 0) {
    Serial.println("[WARNING] No WiFi credentials found. Starting AP mode.");
    startAPMode();
    return;
  }

  WiFi.disconnect();
  WiFi.mode(WIFI_STA);
  delay(200);
  WiFi.begin(ssid.c_str(), password.c_str());
  delay(1000);
  
  Serial.print("[INFO] Connecting to " + String(ssid) + "...");

  int dot_counter = 0;
  int timeout = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - timeout < time_trying) {
    if (dot_counter > 50) {
      Serial.println(".");
      dot_counter = 0;
    } else {
      Serial.print(".");
      dot_counter++;
    }
    
    delay(100);

    if (Serial.available()) {
      serialCommand();
      dot_counter = 0;
    }
  } 

  if (WiFi.status() == WL_CONNECTED) {
    // Connected successfully - set up normal server
    ap_mode_active = false;
    
    Serial.println("\n");  
    Serial.println("[INFO] Connected!");
    Serial.print("[INFO] IP: ");
    Serial.println(WiFi.localIP());
    // Print gateway
    Serial.print("[INFO] Gateway: ");
    Serial.println(WiFi.gatewayIP());
    // Print subnet
    Serial.print("[INFO] Subnet: ");
    Serial.println(WiFi.subnetMask());

    // Set up normal web server routes
    setupNormalServerRoutes();
    
    Serial.println("[INFO] Server online at http://" + WiFi.localIP().toString() + 
                  "/ or http://" + config.mDNS + ".local/");
  } else {
    Serial.println("[ERROR] \nConnection failed! Starting AP mode.");
    startAPMode();
  }
}

// Function to set up normal server routes (extracted from original connect_wifi)
void setupNormalServerRoutes() {
  server.on("/", [](AsyncWebServerRequest *request) {loadFromSPIFFS("/index.html", request);});
  server.on("/Calibration", _Calibration);
  server.on("/readWeights", _readWeights);
  server.on("/OnGoing", experimentOnGoing);
  server.on("/Run", _Run);
  server.on("/RunMelting", _RunMelting);
  server.on("/Stop", _Stop);
  server.on("/temp", SendTemp);
  server.on("/ReadFluo", _ReadFluo);
  server.on("/fluo", SendFluo);
  server.on("/res", SendResistance);    
  server.on("/led_trial", led_trial); 
  server.on("/new_temp", receive_temp);  
  server.on("/data_request", data_request);
  server.on("/last_run_request", last_run_request);
  server.on("/manual_cycle", manual_cycle);  
  server.on("/cycle_time", _cycle_time);
  server.on("/weights", _weights);
  server.on("/lid_temp", _lid_temp);
  server.on("/lid_diff", _lid_difference);
  server.on("/melting_step", _melting_step);
  server.on("/melting_range", _melting_range);
  server.on("/melting_time", _melting_time);
  server.on("/protocols", protocol_library);
  server.on("/variable_gains", _variable_gains); 
  server.on("/free_memory", _free_memory); 
  server.on("/device-config", _device_config);
  server.on("/firmware-update", _firmware_update);
  server.serveStatic("/", SPIFFS, "/");
  
  server.onNotFound(handleNotFound);
  
  // Start the server
  server.begin();
}

// Modified check_wifi function to use AP fallback
void check_wifi_with_fallback() {
  // If in AP mode, nothing to check
  if (ap_mode_active) return;
  
  // If the network disconnected try to reconnect if it fails, try again in one minute
  if (!WiFi.isConnected()) {
    if (millis() - last_reconnect > millis_reconnect) {
      last_reconnect = millis();
      Serial.println("[WARNING] WiFi disconnected. Trying to reconnect.");
      connect_wifi_with_fallback(10000);
    }
  }
}
