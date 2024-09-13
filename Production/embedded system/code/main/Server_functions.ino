void serverBegin() {
    connect_wifi(40000);
    
    MDNS.addService("http", "tcp", 80);
}

void connect_wifi(int time_trying) {

  Serial.println("\n");
  char* ssid = loadCredentials()[0];
  char* password = loadCredentials()[1];

  WiFi.disconnect();
  WiFi.mode(WIFI_STA);
  delay(200);
  WiFi.begin(ssid, password);
  delay(1000);
  
  Serial.print("[INFO] Connecting to " + String(ssid) + ":" + String(password) + "...");

  int dot_counter=0;
  int timeout = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - timeout < time_trying) {

    if (dot_counter > 50)
    {
      Serial.println(".");
      dot_counter=0;
    } else {
      Serial.print(".");
      dot_counter++;
    }
    
    delay(100);

    if (Serial.available())
    {
      serialCommand();
      dot_counter = 0;
    }
  } 

  if (WiFi.status() == WL_CONNECTED)
    {
      Serial.println("\n");  
      Serial.println("[INFO] Connected !");
      Serial.print("[INFO] IP: ");
      Serial.println(WiFi.localIP());
      // Print gateway
      Serial.print("[INFO] Gateway: ");
      Serial.println(WiFi.gatewayIP());
      // Print subnet
      Serial.print("[INFO] Subnet: ");
      Serial.println(WiFi.subnetMask());

      server.on("/", [](AsyncWebServerRequest *request) {loadFromSPIFFS("/index.html", request);});
      server.on("/OnGoing", experimentOnGoing);
      server.on("/Run", _Run);
      server.on("/RunMelting", _RunMelting);
      server.on("/Stop", _Stop);
      server.on("/temp", SendTemp);
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
      server.on("/calibrate_signal", signal_calibration); //Under construction
      server.on("/protocols", protocol_library);
      server.on("/variable_gains", _variable_gains); 
      server.on("/free_memory", _free_memory); 
      server.serveStatic("/",SPIFFS,"/");

      
      server.onNotFound(handleNotFound);  
      server.begin();  
      Serial.println("[INFO] Server online at http://" + WiFi.localIP().toString() +"/ or http://" + config.mDNS + ".local/");
  } else {
      Serial.println("[ERROR] \nConnection failed! Offline mode On.");
      // wifi off
      WiFi.mode(WIFI_OFF);
      last_reconnect = millis();
    }

}

void handleNotFound(AsyncWebServerRequest *request) {
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += request->url();
  message += "\nMethod: ";
  message += (request->method() == HTTP_GET) ? "GET" : "POST";
  message += "\nParameters: ";
  int paramsNr = request->params();
  // add the AsyncWebServer arguments to the message
  message += paramsNr;
  message += "\n";

   for(int i=0; i<paramsNr; i++) {
    AsyncWebParameter* p = request->getParam(i);
    message += " " + p->name() + ": " + p->value() + "\n";
  }
 
  request->send(404, "text/plain", message);
}

bool loadFromSPIFFS(String path, AsyncWebServerRequest *request) {
  String dataType = "text/html";
 
  Serial.print("[INFO] Requested page -> ");
  Serial.println(path);
  if (SPIFFS.exists(path) || SPIFFS.exists(path + ".gz")) {
    AsyncWebServerResponse* response = request->beginResponse(SPIFFS, path);
    if (SPIFFS.exists(path + ".gz")) {
      path += ".gz";
      AsyncWebServerResponse* response = request->beginResponse(SPIFFS, path);
      response->addHeader("Content-Encoding", "gzip");
    } else {
      AsyncWebServerResponse* response = request->beginResponse(SPIFFS, path);
    }
      request->send(response);
  }else{
      handleNotFound(request);
      return false;
  }
  return true;
}

void experimentOnGoing(AsyncWebServerRequest *request) {
  if (OnGoing) {
    request->send(200, "text/plain", "1");
  } else {
    request->send(200, "text/plain", "0");
  }
}

void _Run(AsyncWebServerRequest *request){
  if (!request->hasParam("degrees"))
  {
    request->send(200, "text/plain", "[ERROR] TARGET TEMPERATURE REQUIRED");
  } else {
    request->send(200, "text/plain", "[OK] STARTING NEW PROTOCOL AT " + request->getParam("degrees")->value() + "ºC");

    // reset all the variable_gain
    for(int i = 0; i < 8; i++) {
      variable_gain[i] = 0;
  }


    OnGoing = true;
    start_time = millis();

    float deg = String(request->getParam("degrees")->value()).toFloat();
    set_new_temp (deg,request);

    // Create the new protocol file and write "start"
    File f = SPIFFS.open("/last_run.txt", "w");
    f.print("start\n");
    f.close();
    
    PerformCycle();
    
  }
}

void _RunMelting(AsyncWebServerRequest *request){

    request->send(200, "text/plain", "[OK] STARTING NEW MELTING CURVE");

    // reset all the variable_gain
    for(int i = 0; i < 8; i++) {
      variable_gain[i] = 0;
    }

    OnGoing = true;
    OnGoingMelting = true;
    start_time = millis();

    heater_goal = config.MELTING_RANGE[0];

    PWM_PID_1.Start(calculate_temperature(WELL1),PWM_PID_1.Run(heater_goal),heater_goal);
    PWM_PID_2.Start(calculate_temperature(WELL2),PWM_PID_2.Run(heater_goal),heater_goal);
    PWM_PID_3.Start(calculate_temperature(WELL3),PWM_PID_3.Run(heater_goal),heater_goal);
    PWM_PID_LID.Start(calculate_temperature(LID),PWM_PID_LID.Run(config.LID_TEMP),config.LID_TEMP);

    // Create the new protocol file and write "start"
    File f = SPIFFS.open("/last_run.txt", "w");
    f.print("start\n");
    f.close();
    
    PerformCycle();
  
}

void _Stop(AsyncWebServerRequest *request){ //Stop the protocol by client request
  request->send(200, "text/plain", "[OK] STOPPING PROTOCOL");

  if (OnGoingMelting == true) 
    _StopMelting();
  else {
    Serial.println("[INFO] Stopping protocol.");
    OnGoing = false;
    start_time = 0;
    time_before_interruption = 0;
    set_new_temp (0,request);

    // write "stop" in the new protocol file
    File f = SPIFFS.open("/last_run.txt", "a+");
    f.println("stop");
    f.close(); 
  }  
}

void _StopMelting(){ //Stop melting once it's completed

  Serial.println("[INFO] Stopping melting curve protocol.");

  OnGoing = false;
  OnGoingMelting = false; //this gets clear in the next data_request
  last_cycle_melting = true; //to send the data to the client and inform it that protocol ended
  melting_temp = config.MELTING_RANGE[0];
  start_time = 0;
  time_before_interruption = 0;
  heater_goal = 0;

  PWM_PID_1.Start(calculate_temperature(WELL1),PWM_PID_1.Run(heater_goal),heater_goal);
  PWM_PID_2.Start(calculate_temperature(WELL2),PWM_PID_2.Run(heater_goal),heater_goal);
  PWM_PID_3.Start(calculate_temperature(WELL3),PWM_PID_3.Run(heater_goal),heater_goal);
  PWM_PID_LID.Start(calculate_temperature(LID),PWM_PID_LID.Run(config.LID_TEMP),config.LID_TEMP);

  // write "stop" in the new protocol file
  File f = SPIFFS.open("/last_run.txt", "a+");
  f.println("stop");
  f.close(); 
}

void set_new_temp(float temp,AsyncWebServerRequest *request){
   if (temp < 0 || temp > 100)
  {
    request->send(200, "text/plain", "[ERROR] TEMPERATURE NOT IN RANGE [0ºC-100ºC]");
  } else {
  request->send(200, "text/plain", "TARGET TEMPERATURE SET TO " + String(temp) + "ºC");
  heater_goal = temp;
  Serial.println("[INFO] Heater new target: " + String(heater_goal) + "ºC");
  
  }

  PWM_PID_1.Start(calculate_temperature(WELL1),PWM_PID_1.Run(heater_goal),heater_goal);
  PWM_PID_2.Start(calculate_temperature(WELL2),PWM_PID_2.Run(heater_goal),heater_goal);
  PWM_PID_3.Start(calculate_temperature(WELL3),PWM_PID_3.Run(heater_goal),heater_goal);
  PWM_PID_LID.Start(calculate_temperature(LID),PWM_PID_LID.Run(config.LID_TEMP),config.LID_TEMP);
}

void SendTemp(AsyncWebServerRequest *request)
{
  request->send(200, "text/plain", String(calculate_temperature(WELL1),4));
  Serial.println("[INFO] Temperature requested and sent.");
}

void SendFluo (AsyncWebServerRequest *request)
{
  String buff = "";
  for (int i = 0; i <8; i++)
  {
    int value_off = calculate_fluorescence(i);
    led_n_on(i);
    int value_on = calculate_fluorescence(i);
    led_n_off(i);
    buff += String(value_on - value_off) + ",";
  }
  request->send(200, "text/plain", buff);
  Serial.println("[INFO] Fluorescence requested and sent.");
}

void SendResistance (AsyncWebServerRequest *request)
{
  request->send(200, "text/plain", String(calculate_resistance(0)));
  Serial.println("[INFO] Resistance requested and sent.");
}

void led_trial(AsyncWebServerRequest *request)
{
  request->send(200, "text/plain", "ok");
  for (int i = 0; i < 8; i++)
  {
    request->send(200, "text/plain", "ok");
    led_n_on(i);
    delay(500);
    led_n_off(i);
  }
}

void receive_temp (AsyncWebServerRequest *request) {
   if (!request->hasParam("degrees"))
  {
    request->send(200, "text/plain", "[ERROR] TARGET TEMPERATURE REQUIRED");
  } else {
    float deg = String(request->getParam("degrees")->value()).toFloat();
    set_new_temp (deg,request);
  }
}

void data_request(AsyncWebServerRequest *request) {
  Serial.println("[INFO] Data requested");

  if (OnGoing)
  {
    request->send(SPIFFS, "/last_run.txt");
  } else {
    if (last_cycle_melting)
    {
      last_cycle_melting = false;
      Serial.println("[INFO] Stop message sent to the client.");
      request->send(SPIFFS, "/last_run.txt"); //the melting curve just finished
    } else {
      request->send(200, "text/plain", "[ERROR] NO PROTOCOL RUNNING");
    }
  }
}

void last_run_request(AsyncWebServerRequest *request) {
  Serial.println("[INFO] Data from last run requested and sent");
  request->send(SPIFFS, "/last_run.txt");
}

void manual_cycle(AsyncWebServerRequest *request) {
  if (!OnGoing)
  {
    request->send(200, "text/plain", "[ERROR] PROTOCOL NOT RUNNING");
  } else {
    request->send(200, "text/plain", "[OK] STARTING MANUAL CYCLE");
    last_cycle_time = millis() - (config.CYCLE_TIME + 1);
  }
}

void _cycle_time(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    config.CYCLE_TIME = String(request->getParam("set")->value()).toInt();
    request->send(200, "text/plain", "[OK] CYCLE TIME CHANGED TO " + String(config.CYCLE_TIME) + "ms");

    //save it to the config file
    saveConfig();

    Serial.println("[INFO] Cycle time changed to " + String(config.CYCLE_TIME) + "ms");
  } else {
    request->send(200, "text/plain", String(config.CYCLE_TIME));
  }
}

void _weights(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("calibrate"))
  {

  } else {
    String result = "";
    for (int i = 0; i < 7; i++)
    {
      result += String(config.WEIGHTS[i]) + ",";
    }
    result += String(config.WEIGHTS[7]);

    request->send(200, "text/plain", result);
  }
}

void _lid_temp(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    config.LID_TEMP = String(request->getParam("set")->value()).toFloat();
    request->send(200, "text/plain", "[OK] LID TEMPERATURE CHANGED TO " + String(config.LID_TEMP) + "ºC");

    //save it to the config file
    saveConfig();

    Serial.println("[INFO] Lid temperature changed to " + String(config.LID_TEMP) + "ºC");
  } else {
    request->send(200, "text/plain", String(config.LID_TEMP));
  }
}

void _lid_difference(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    config.LID_DIFFERENCE = String(request->getParam("set")->value()).toFloat();
    request->send(200, "text/plain", "[OK] LID TEMPERATURE DIFFERENCE CHANGED TO " + String(config.LID_DIFFERENCE) + "ºC");

    //save it to the config file
    saveConfig();

    Serial.println("[INFO] Lid temperature difference changed to " + String(config.LID_DIFFERENCE) + "ºC");
    

  } else {
    request->send(200, "text/plain", String(config.LID_DIFFERENCE));
  }
}

void _melting_step(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    config.MELTING_STEP = String(request->getParam("set")->value()).toFloat();
    request->send(200, "text/plain", "[OK] MELTING STEP CHANGED TO " + String(config.MELTING_STEP) + "ºC");

    Serial.println("[INFO] Melting step changed to " + String(config.MELTING_STEP) + "ºC");
    saveConfig();
    

  } else {
    request->send(200, "text/plain", String(config.MELTING_STEP));
  }
}

void _melting_time(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    config.MELTING_TIME= String(request->getParam("set")->value()).toFloat();
    request->send(200, "text/plain", "[OK] MELTING TIME CHANGED TO " + String(config.MELTING_TIME) + "ms");

    Serial.println("[INFO] Melting time changed to " + String(config.MELTING_TIME) + "ms");
    saveConfig();
    
  } else {
    request->send(200, "text/plain", String(config.MELTING_TIME));
  }
}

void _melting_range(AsyncWebServerRequest *request) {
  // if there's a param called "cycle_time", change the cycle time
  if (request->hasParam("set"))
  {
    // parse the string "0,0" into the two floats of config.MELTING_RANGE
    String range = request->getParam("set")->value();
    config.MELTING_RANGE[0] = range.substring(0, range.indexOf(",")).toFloat();
    config.MELTING_RANGE[1] = range.substring(range.indexOf(",") + 1).toFloat();
    request->send(200, "text/plain", "[OK] MELTING RANGE CHANGED TO " + range + "ºC");

    Serial.println("[INFO] Melting range changed to [" + String(config.MELTING_RANGE[0]) + "," + String(config.MELTING_RANGE[1]) + "] ºC");
    saveConfig();

  } else {
    String range = String(config.MELTING_RANGE[0]) + "," + String(config.MELTING_RANGE[1]);
    request->send(200, "text/plain", range);
  }
}

void protocol_library (AsyncWebServerRequest *request) {
  // if there's no argument we send back the protocol library JSON stored in protocols.txt
  if (!request->hasArg("save_new"))
  {
    // open the file stored in SPIFFS protocols.txt and send it back as plain text
    if (config.DEBUG == 1) Serial.println("[DEBUG] Sending protocol library");
    AsyncWebServerResponse* response = request->beginResponse(SPIFFS, "/protocols.txt");
    request->send(response);
  } 
}

void signal_calibration (AsyncWebServerRequest *request) {
  // If there's a protcol running, send an error
  if (OnGoing) {
    request->send(200, "text/plain", "[ERROR] CAN'T START CALIBRATION, PROTOCOL RUNNING");
  } else {
    // If there's no protocol running, start the calibration
    
    float buff[8];

    for (int i = 0; i < 8; i++) {
      
      //take 10 samples and do the mean
      int mean = 0;
      for (int j = 0; j < 5; j++) {
        int value_off = calculate_fluorescence(i); 
        led_n_on(i);
        delay(10);
        int value_on = calculate_fluorescence(i);
        led_n_off(i);
        mean += value_on - value_off;
      }
      mean = mean / 5;
      buff[i] = mean;

      //check the position of the smaller
      int min = 0;
      for (int i = 0; i < 8; i++) {
        if (buff[i] < buff[min]) {
          min = i;
        }
      }

      for (int i = 0; i < 8; i++) {
        while (buff[i] > buff[min] && i != min) {
          config.WEIGHTS[i] = config.WEIGHTS[i] - 1;
          int mean = 0;
          int passes = 0;
          for (int j = 0; j < 5; j++,passes++) {
            int value_off = calculate_fluorescence(i); 
            led_n_on(i);
            delay(10);
            int value_on = calculate_fluorescence(i);
            led_n_off(i);
            int value = value_on - value_off;
            if (value - buff[min] > 100) {
              j=10;
            }
            mean += value;
          }
          mean = mean / passes;
          buff[i] = mean;
          led_n_off(i);
        }
      }

      saveConfig();

      //send the weights to the websocket
      String result = "";
      for (int i = 0; i < 7; i++)
      {
        result += String(config.WEIGHTS[i]) + ",";
      }
      result += String(config.WEIGHTS[7]);
      request->send(200, "text/plain", result);
    }
  }
}

void _variable_gains (AsyncWebServerRequest *request) {
  String answer = String(variable_gain[0]);
  for (int i = 1; i<8; i++)
  {
    answer = answer + "," + variable_gain[i];
  }

  request->send(200, "text/plain", answer);
}

void _free_memory (AsyncWebServerRequest *request) {
  String answer = getFreeSpiffsSpacePercentage();

  request->send(200, "text/plain", answer);
}

String fetchFileContent(String url) {
  Serial.println("[INFO] Fetching file content from: " + url);
  HTTPClient http;
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.println("[ERROR] Failed to fetch file: " + url);
    return String();
  }
  return http.getString();
}

void fetchAndSaveFile(String url, String localPath) {
  Serial.println("[INFO] Fetching and saving file from: " + url + " to: " + localPath);
  HTTPClient http;
  http.begin(url);
  http.setTimeout(5000);  // Increase timeout to 10 seconds
  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.println("[ERROR] Failed to fetch file: " + url);
    return;
  }
  SPIFFS.remove(localPath);
  File file = SPIFFS.open(localPath, "w");
  uint8_t buffer[4096];  // Buffer for holding data chunks
  WiFiClient* stream = http.getStreamPtr();
  int emptyReads = 0;  // Counter for empty reads
  while (http.connected() && (stream->available() > 0 || stream->connected())) {
    int bytesRead = stream->readBytes(buffer, sizeof(buffer));
    if (bytesRead == 0) {
      emptyReads++;
      if (emptyReads > 5) {  // Break loop after 10 consecutive empty reads
        break;
      }
    } else {
      emptyReads = 0;  // Reset counter if data is read
    }
    file.write(buffer, bytesRead);
  }
  file.close();
}


String parseVersion(String html) {
  int start = html.indexOf("<!-- Version: ") + 14;
  int end = html.indexOf(" -->", start);
  if (start < 0 || end < 0) {
    return String();  // Return an empty string if the version comment is not found
  }
  return html.substring(start, end);
}

void updateSPIFFS() {
  Serial.println("[INFO] Updating files...");
  String onlineIndexHtml = fetchFileContent("http://" + UPDATE_SERVER + "/data/index.html");

  File localIndexHtmlFile = SPIFFS.open("/index.html", "r");
  if (!localIndexHtmlFile) {
    Serial.println("[ERROR] Failed to open local index.html");
    return;
  }
  String localIndexHtml = localIndexHtmlFile.readString();
  localIndexHtmlFile.close();

  String onlineVersion = parseVersion(onlineIndexHtml);
  String localVersion = parseVersion(localIndexHtml);

  Serial.println("[INFO] Online version: " + onlineVersion);
  Serial.println("[INFO] Local version: " + localVersion);

  if (onlineVersion != localVersion) {
    Serial.println("[INFO] Online version is newer, updating files...");
    // Online version is newer, fetch file list
    String fileListJson = fetchFileContent("http://" + UPDATE_SERVER + "/file_list");
    // Parse the JSON and extract the file list
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, fileListJson);
    JsonArray fileList = doc["files"];
    // Update each file
    for (JsonVariant file : fileList) {
      fetchAndSaveFile("http://" + UPDATE_SERVER + "/data/" + file.as<String>(), "/" + file.as<String>());
    }
    Serial.println("[INFO] SPIFFS updated!");
  } else {
    Serial.println("Local version is up-to-date, no need to update files.");
  }
}