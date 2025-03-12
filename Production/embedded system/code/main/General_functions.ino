void Initialize() {

  Serial.begin(115200);
  delay(500); //To give the serial port time to start up

  Wire.begin();

  if(!SPIFFS.begin()){
    Serial.println("[ERROR] An Error has occurred while mounting SPIFFS");
    return;
  }

  loadConfig();
 
  esp32FOTA.setManifestURL("http://" + UPDATE_SERVER + "/data/fota.json");

    //config.mDNS to char*
  char mDNS[config.mDNS.length() + 1];
  config.mDNS.toCharArray(mDNS, config.mDNS.length() + 1);

  //Initialize the mDNS in config.mDNS
  if (!MDNS.begin(mDNS)) {
    Serial.println("[ERROR] Error setting up MDNS responder!");
  }
 
  Serial.println("mDNS: " + config.mDNS);

  //Initialize the LEDs
  if (config.VERSION == 1) {
    FastLED.addLeds<WS2812B, DATA_PIN, RGB>(leds, NUM_LEDS).setCorrection(UncorrectedColor);
  } else {
    leds2.init(); // Initialize the TLC59108
    leds2.setRegister(0x11,  0x00); // Set general address to 0
    leds2.setLedOutputMode(TLC59108::LED_MODE::PWM_IND);
  }


  PD_array.setGain(GAIN_SIXTEEN);  
  PD_array.begin(0x48);


  //PWM pins as an output and initilize them
  pinMode(PWM_1, OUTPUT);
  pinMode(PWM_2, OUTPUT);
  pinMode(PWM_3, OUTPUT);
  pinMode(PWM_LID, OUTPUT);

  digitalWrite(PWM_1, LOW);
  digitalWrite(PWM_2, LOW);
  digitalWrite(PWM_3, LOW);
  digitalWrite(PWM_LID, LOW);

  //myPID.SetOutputLimits(0,255);
  PWM_PID_1.SetSampleTime(PID_SAMPLE);
  PWM_PID_2.SetSampleTime(PID_SAMPLE);
  PWM_PID_3.SetSampleTime(PID_SAMPLE);
  PWM_PID_LID.SetSampleTime(PID_SAMPLE);

  if (config.VERSION == 2)
  {
    PWM_PID_LID.SetOutputLimits(0,255); // set maximun value of LID to 125
    PWM_PID_1.SetOutputLimits(0,125);
    PWM_PID_2.SetOutputLimits(0,125);
    PWM_PID_3.SetOutputLimits(0,125);
  } else {
    PWM_PID_LID.SetOutputLimits(0,255); // set maximun value of LID to 255
    PWM_PID_1.SetOutputLimits(0,255);
    PWM_PID_2.SetOutputLimits(0,255);
    PWM_PID_3.SetOutputLimits(0,255);
  }

  PWM_PID_1.Start(calculate_temperature(WELL1),0,0);
  PWM_PID_2.Start(calculate_temperature(WELL2),0,0);
  PWM_PID_3.Start(calculate_temperature(WELL3),0,0);
  PWM_PID_LID.Start(calculate_temperature(LID),0,0);


  pinMode(SW1, OUTPUT);
  pinMode(SW2, OUTPUT);
  pinMode(SW3, OUTPUT);
  pinMode(SW4, OUTPUT);

  serverBegin();
  manage_reset();

  Serial.println("[INFO] Initialization complete");
  

}

void manage_reset() {

  // read the last line of last_run.txt
  if (!SPIFFS.exists("/last_run.txt")) {
    Serial.println("[WARNING] last_run.txt file don't exist. If this is your first run, please ignore this warning.");
    return;
  }

  File f = SPIFFS.open("/last_run.txt", "r+");
  String last_line = ""; // to save last line of last_run.txt
  String buffer = f.readStringUntil('\n'); // to read the last line of last_run.txt

  //Otherwise we continue reading until the last line
  while (f.available() && (buffer.length() > 3)) { 
    last_line = buffer;  
    buffer = f.readStringUntil('\n');
  }
  f.close();

  // debug last line split
  if (config.DEBUG)
  {
    Serial.print("[DEBUG] last line: ");
    Serial.println(buffer);
    Serial.println();
  }

  if (buffer.indexOf("stop") == -1) {
    Serial.println("[WARNING] A protocol was interrupted. Re-starting the protocol.");

    //count the "," in last_line
    int count = 0;
    for (int i = 0; i < last_line.length(); i++) {
      if (last_line.charAt(i) == ',') {
        count++;
      }
    }

    //If the file is empty we return an error
    if (count == 0) {
      Serial.println("[WARNING] last_run.txt file is empty. That may indicate a problem saving the last data");
      
      //Cancel the run
      OnGoing = false;

      //write on last_run.txt "stop" and close the file
      f.println("stop");
      f.close();
      return;
    }

    // split last line values by ","
    String last_line_split[count+1];

    int i = 0;
    for (int j = 0; j < last_line.length(); j++) {
      if (last_line.charAt(j) == ',') {
        i++;
      } else {
        last_line_split[i] += last_line.charAt(j);
      }
    }

    time_before_interruption = (long int)last_line_split[0].toInt();
    
    OnGoing = true;
    start_time = millis();

    heater_goal = (float)last_line_split[1].toFloat();
    
    Serial.println("[INFO] Heater new target: " + String(heater_goal) + "ºC");

    PWM_PID_1.Start(calculate_temperature(WELL1),PWM_PID_1.Run(heater_goal),heater_goal);
    PWM_PID_2.Start(calculate_temperature(WELL2),PWM_PID_2.Run(heater_goal),heater_goal);
    PWM_PID_3.Start(calculate_temperature(WELL3),PWM_PID_3.Run(heater_goal),heater_goal);
    PWM_PID_LID.Start(calculate_temperature(LID),PWM_PID_LID.Run(config.LID_TEMP),config.LID_TEMP);

    // Continue with the protocol file
    File f = SPIFFS.open("/last_run.txt", "a+");
    f.close();

    return;
  }
}

int runPID() {
  if (OnGoing)
  {
    int TEMP_PID_1 = calculate_temperature(WELL1);
    int TEMP_PID_2 = calculate_temperature(WELL2);
    int TEMP_PID_3 = calculate_temperature(WELL3);
    int TEMP_PID_LID = calculate_temperature(LID);

    DATA_PID_LID = PWM_PID_LID.Run(TEMP_PID_LID);
    analogWrite(PWM_LID, DATA_PID_LID);

    //We wait for the LID to be hot to heat the wells
    if (sq(config.LID_TEMP - TEMP_PID_LID) < sq(config.LID_DIFFERENCE))
    {
      DATA_PID_1 = PWM_PID_1.Run(TEMP_PID_1);
      DATA_PID_2 = PWM_PID_2.Run(TEMP_PID_2);
      DATA_PID_3 = PWM_PID_3.Run(TEMP_PID_3);
      analogWrite(PWM_1, DATA_PID_1);
      analogWrite(PWM_2, DATA_PID_2);
      analogWrite(PWM_3, DATA_PID_3);
    } else {
      analogWrite(PWM_1, 0);
      analogWrite(PWM_2, 0);
      analogWrite(PWM_3, 0);
    }
  } else {
    analogWrite(PWM_1, 0);
    analogWrite(PWM_2, 0);
    analogWrite(PWM_3, 0);
    analogWrite(PWM_LID, 0);
  }
  
}

char** loadCredentials() {
    if (SPIFFS.exists("/credentials.txt")) {
    File file = SPIFFS.open("/credentials.txt", "r");
    String ssid;
    String password;
    
    if (file) {
      // Read the ssid, password from the file
      ssid = file.readStringUntil(',');
      password = file.readStringUntil('\r');
      file.close();

      // Return ssid + password
      char** result = new char*[2];
      result[0] = new char[ssid.length() + 1];
      result[1] = new char[password.length() + 1];
      strcpy(result[0], ssid.c_str());
      strcpy(result[1], password.c_str());
      return result;
    }
  } else {
    Serial.println("[Error] Problem loading credentials");
  }
}

void loadConfig(){
  if (SPIFFS.exists("/config.txt")) {
    File file = SPIFFS.open("/config.txt", "r");

    if (file) 
    {
      // load the file as a JSON

      String json_string = file.readString();
      file.close();

      // parse it as a json
      DynamicJsonDocument json(1024);
      deserializeJson(json, json_string);
      // -------------------------------------- VERSION -----------------------------------
      config.VERSION = json["version"].as<int>();

      //-------------------------------------- mDNS -----------------------------------

      // load the mDNS name
      
      config.mDNS = json["mDNS"].as<String>();
      

      //----------------------------------- CYCLE_TIME --------------------------------
      
      config.CYCLE_TIME = json["cycle_time"].as<unsigned int>();

      //----------------------------------- LOAD WEIGHTS --------------------------------

      //get the weights as a string
      String weights = json["weights"].as<String>();

      //separate the weights by ","
      int count = 0;
      for (int i = 0; i < weights.length(); i++) {
        if (weights.charAt(i) == ',') {
          count++;
        }
      }

      //split the weights by ","
      String weights_split[count+1];

      int i = 0;
      for (int j = 0; j < weights.length(); j++) {
        if (weights.charAt(j) == ',') {
          i++;
        } else if  (weights.charAt(j) != '[' and weights.charAt(j) != ']') {
          weights_split[i] += weights.charAt(j);
        }
      }
      //convert the weights to float
      for (int j = 0; j < count+1; j++) {
        config.WEIGHTS[j] = (float)weights_split[j].toFloat();
      }

      // ----------------------------------- LOAD LID TEMPERATURE AND DIFF --------------------------------

      config.LID_TEMP = json["lid_temp"].as<float>();
      config.LID_DIFFERENCE = json["lid_difference"].as<float>();

      // ----------------------------------- LOAD MELTING CURVE VALUES --------------------------------
      
      config.MELTING_STEP = json["melting_step"].as<float>();
      config.MELTING_TIME = json["melting_time"].as<unsigned int>();

      // get the melting range as a string
      String melting_range = json["melting_range"].as<String>();
            
      //separate the melting range by ","
      count = 0;
      for (int i = 0; i < melting_range.length(); i++) {
        if (melting_range.charAt(i) == ',') {
          count++;
        }
      }

      //split the melting range by ","
      String melting_range_split[count+1];

      i = 0;
      for (int j = 0; j < melting_range.length(); j++) {
        if (melting_range.charAt(j) == ',') {
          i++;
        } else if  (melting_range.charAt(j) != '[' and melting_range.charAt(j) != ']') {
          melting_range_split[i] += melting_range.charAt(j);
        }
      }
      //convert the melting range to float
      for (int j = 0; j < count+1; j++) {
        config.MELTING_RANGE[j] = (float)melting_range_split[j].toFloat();
      }

      // adjust melting temp variable to the first value of the melting range
      melting_temp = config.MELTING_RANGE[0];
      // ---------------------------------- DEBUG -------------------------------------
      
      if (json["debug"] == true) {
        config.DEBUG = true;
      } else {
        config.DEBUG = false;
      }
      
      if (config.DEBUG == true) {
        Serial.println("[DEBUG] Config file content: " + json_string);
      }


    } else {
      Serial.println("[ERROR] Problem loading configuration file");
    }

  } else {
    Serial.println("[ERROR] Problem loading configuration file");
  }
}

void saveConfig(){
  DynamicJsonDocument json(1024);

  // save the version
  json["version"] = config.VERSION;

  // save mDNS name
  json["mDNS"] = config.mDNS;
  json["cycle_time"] = config.CYCLE_TIME;
  json["debug"] = config.DEBUG;

  String weights_string = "[";
  for (int i=0;i<8;i++){
    weights_string += config.WEIGHTS[i];
    if (i != 7) {
      weights_string += ",";
    }
  }
  weights_string += "]";

  json["weights"] = weights_string;
  json["lid_temp"] = config.LID_TEMP;
  json["lid_difference"] = config.LID_DIFFERENCE;

  String melting_range_string = "[" + String(config.MELTING_RANGE[0]) + "," + String(config.MELTING_RANGE[1]) + "]";

  json["melting_range"] = melting_range_string;
  json["melting_step"] = config.MELTING_STEP;
  json["melting_time"] = config.MELTING_TIME;
  
  // Serial.println("[DEBUG] Config file content: " + json.as<String>());

  File file = SPIFFS.open("/config.txt", "w");
  if (file) {
    serializeJson(json, file);
    file.close();
  } else {
    Serial.println("[ERROR] Problem saving configuration file");
  }
}

void saveCredentials (String ssid, String password)
{
  File file = SPIFFS.open("/credentials.txt", "w+");
  if (file) {
    //erase all the content in the file
    file.seek(0);
    // write the credentials
    file.print(ssid);
    file.print(",");
    file.println(password);
    file.close();
  } else {
    Serial.println("[ERROR] Problem saving credentials");
  }
}

void PerformCycle()
{
  // Run if we are above the threshold in time and we have an ongoing experiment
  if ((millis() - last_cycle_time > config.CYCLE_TIME) && OnGoing)
  {
    last_cycle_time = millis();
    // Perform the fluorescence cycle
    String fluorescence = runFluorescenceCycle();
    
    String tempe = String(calculate_temperature(WELL1)) + "," +
                   String(calculate_temperature(WELL2)) + "," +
                   String(calculate_temperature(WELL3)) + "," +
                   String(calculate_temperature(LID));
    String resistance = String(calculate_resistance(WELL1)) + "," +
                        String(calculate_resistance(WELL2)) + "," +
                        String(calculate_resistance(WELL3)) + "," +
                        String(calculate_resistance(LID));
    String resistance_chamber = "1234";
    String time_cycle = String(((long)millis() - start_time) + time_before_interruption);
    String free_space_SPIFFS = getFreeSpiffsSpacePercentage();
    String result = time_cycle + "," + heater_goal + fluorescence + tempe + "," + resistance + "," + resistance_chamber + "," + free_space_SPIFFS + "\n";
    
    // Process free_space_SPIFFS string to float (remove the trailing "%" if needed)
    free_space_SPIFFS.remove(free_space_SPIFFS.length() - 1);
    float free_space = free_space_SPIFFS.toFloat();
    Serial.print("[DEBUG] Free space on SPIFFS: ");
    Serial.println(free_space);
    
    // Store result in SPIFFS
    File file = SPIFFS.open("/last_run.txt", "a+");
    if (file && free_space >= 5) {
      file.print(result);
      file.close();
      Serial.println("[INFO] New cycle performed and stored.");
    } else {
      Serial.println("[INFO] New cycle performed but NOT stored :(.");
    }
  }
}

void PerformMelting() {
  // measure the temperature of the LID
  float LID_measured_temp = calculate_temperature(LID);
  float WELL1_measured_temp = calculate_temperature(WELL1);

  //check 3 conditions to start the melting
  // 1st: LID_measured_temp is at less than LID_DIFFERENCE from the lid goal
  // 2nd: Have passed MELTING_TIME since the last melting step
  // 3rd: WELL1_measured_temp is at less than 0.5ºC from the heater goal
  if (OnGoingMelting && (sq(config.LID_TEMP-LID_measured_temp) < sq(config.LID_DIFFERENCE)) && ((millis()-last_melting_cycle_time) > config.MELTING_TIME) && (sq(WELL1_measured_temp-heater_goal) < sq(0.5))) {

    last_melting_cycle_time = millis();

    // Measure the temperature mean of the 3 wells
    float temp_mean = (calculate_temperature(WELL1) + calculate_temperature(WELL2) + calculate_temperature(WELL3))/3;
    // if the temperature is not over melting_range, increase the temperature by one degree
    if (temp_mean <= config.MELTING_RANGE[1]) {
      heater_goal = heater_goal + config.MELTING_STEP;

      PWM_PID_1.Start(calculate_temperature(WELL1),PWM_PID_1.Run(heater_goal),heater_goal);
      PWM_PID_2.Start(calculate_temperature(WELL2),PWM_PID_2.Run(heater_goal),heater_goal);
      PWM_PID_3.Start(calculate_temperature(WELL3),PWM_PID_3.Run(heater_goal),heater_goal);
      PWM_PID_LID.Start(calculate_temperature(LID),PWM_PID_LID.Run(config.LID_TEMP),config.LID_TEMP);
    } else {
      _StopMelting();
    }
  }
}

String runFluorescenceCycle() {
  String fluorescence = ",";
  for (int i = 0; i < 8; i++) {
    // Reset the variable gain for the current channel
    variable_gain[i] = 0;
    
    // Background calculation
    PD_array.setGain(GAIN_SIXTEEN);
    int raw_background = calculate_fluorescence(i);
    int value_off = raw_background * 0.0078125;
    
    // Signal calculation
    float value_on = 32001; // initial value to ensure loop entry
    led_n_on(i);
    
    int iterations = 0;
    while (value_on > 32000 && variable_gain[i] < 6 && iterations < 10) {
      PD_array.setGain(gain_dict[variable_gain[i]]);
      value_on = calculate_fluorescence(i);
      if (value_on > 32000 && variable_gain[i] < 6) {
        variable_gain[i] += 1;
      }
      iterations++;
    }
    
    // Convert value_on to mV using step factor corresponding to the current gain
    float value_on_converted = value_on * step_dict[variable_gain[i]];
    
    // Turn LED off
    led_n_off(i);
    
    // Subtract background from signal and append to the fluorescence string
    float fluorescence_value = value_on_converted - value_off;
    char buffer[50];
    sprintf(buffer, "%.3f", fluorescence_value);
    fluorescence += String(buffer);
    fluorescence += ",";
  }

  // Return the assembled fluorescence string.
  return fluorescence;
}

void calibrateFluorescence() {
  const int maxIterations = 10;           // Maximum number of calibration iterations
  const float learningRate = 0.5;           // Fraction of the difference to adjust per iteration
  const float convergenceThreshold = 0.05;   // When max weight change is below this, calibration is complete

  Serial.println("[INFO] Calibration started...");

  // --- Step 1: Reset all channel weights to 100 ---
  for (int i = 0; i < 8; i++) {
    config.WEIGHTS[i] = 100.0;
  }

  // --- Step 2: Determine the reference channel from an initial measurement ---
  String initialStr = runFluorescenceCycle();
  int initialValues[8];
  int start = 0;
  if (initialStr.charAt(0) == ',') {
    start = 1; // Skip the initial comma
  }
  for (int i = 0; i < 8; i++) {
    int commaIndex = initialStr.indexOf(',', start);
    if (commaIndex == -1) break;
    String token = initialStr.substring(start, commaIndex);
    initialValues[i] = token.toInt();
    start = commaIndex + 1;
  }
  
  // Find the channel with the lowest fluorescence reading (this will be our reference)
  int refChannel = 0;
  int minFluorescence = initialValues[0];
  for (int i = 1; i < 8; i++) {
    if (initialValues[i] < minFluorescence) {
      minFluorescence = initialValues[i];
      refChannel = i;
    }
  }
  Serial.print("[DEBUG] Reference channel determined: ");
  Serial.print(refChannel);
  Serial.print(" with initial value: ");
  Serial.println(minFluorescence);

  // --- Step 3: Iterative calibration loop ---
  for (int iter = 0; iter < maxIterations; iter++) {
    // Take two measurements in this iteration and average them.
    int values1[8], values2[8], avgValues[8];
    
    // --- First measurement ---
    String fluorescenceStr1 = runFluorescenceCycle();
    start = 0;
    if (fluorescenceStr1.charAt(0) == ',') { start = 1; }
    for (int i = 0; i < 8; i++) {
      int commaIndex = fluorescenceStr1.indexOf(',', start);
      if (commaIndex == -1) break;
      String token = fluorescenceStr1.substring(start, commaIndex);
      values1[i] = token.toInt();
      start = commaIndex + 1;
    }
    
    // --- Second measurement ---
    String fluorescenceStr2 = runFluorescenceCycle();
    start = 0;
    if (fluorescenceStr2.charAt(0) == ',') { start = 1; }
    for (int i = 0; i < 8; i++) {
      int commaIndex = fluorescenceStr2.indexOf(',', start);
      if (commaIndex == -1) break;
      String token = fluorescenceStr2.substring(start, commaIndex);
      values2[i] = token.toInt();
      start = commaIndex + 1;
    }
    
    // Compute the average reading for each channel
    for (int i = 0; i < 8; i++) {
      avgValues[i] = (values1[i] + values2[i]) / 2;
    }
    
    // Debug: print the averaged readings
    Serial.print("[DEBUG] Iteration ");
    Serial.print(iter);
    Serial.print(" averaged readings: ");
    for (int i = 0; i < 8; i++) {
      Serial.print(avgValues[i]);
      Serial.print(" ");
    }
    Serial.println();

    // Get the reference channel's averaged fluorescence reading.
    int refFluorescence = avgValues[refChannel];
    Serial.print("[DEBUG] Reference channel (");
    Serial.print(refChannel);
    Serial.print(") reading: ");
    Serial.println(refFluorescence);

    // --- Step 4: Update weights gradually based on the current weight ---
    // For channel j, we assume its current measurement is influenced by its current weight W.
    // To have its fluorescence match the reference (with weight 100), the ideal weight should be:
    //      idealWeight = W * (refFluorescence / avgValues[j])
    // We then update gradually.
    float maxChange = 0.0;
    for (int j = 0; j < 8; j++) {
      float idealWeight;
      if (j == refChannel) {
        // For the reference channel, we always keep the weight at 100.
        idealWeight = 100.0;
      } else {
        if (avgValues[j] != 0) {
          idealWeight = config.WEIGHTS[j] * ((float)refFluorescence / (float)avgValues[j]);
        } else {
          idealWeight = config.WEIGHTS[j]; // no update if reading is zero
        }
        // Clamp to a maximum of 100.
        if (idealWeight > 100.0) {
          idealWeight = 100.0;
        }
      }
      float oldWeight = config.WEIGHTS[j];
      float newWeight = oldWeight + learningRate * (idealWeight - oldWeight);
      config.WEIGHTS[j] = newWeight;
      float change = fabs(newWeight - oldWeight);
      if (change > maxChange) {
        maxChange = change;
      }
      Serial.print("[DEBUG] Channel ");
      Serial.print(j);
      Serial.print(" ideal: ");
      Serial.print(idealWeight, 2);
      Serial.print(", updated weight: ");
      Serial.println(newWeight, 2);
    }
    Serial.print("[DEBUG] Max weight change this iteration: ");
    Serial.println(maxChange, 2);
    
    // Save the new configuration so the changes take effect.
    saveConfig();
    delay(100); // Allow time for new weights to affect LED emission
    
    // Check for convergence: if the maximum weight change is small, stop iterating.
    if (maxChange < convergenceThreshold) {
      Serial.println("[DEBUG] Calibration complete: weights have converged.");
      break;
    }
  }
}

// Check available HEAP memory
int free_Heap_Memory() {
  int free_memory = ESP.getFreeHeap();
  return free_memory;
}

// get free esp32 flash memory
int free_Flash_Memory() {
  int free_memory = getFreeFlash();
  return free_memory;
}

int getFreeFlash() {
  int free_memory = ESP.getFreeSketchSpace();
  return free_memory;
}

void check_wifi() {
  // if the network disconnected try to reconnect if it fails, try again in one minute
  if (!WiFi.isConnected()) {
    if (millis() - last_reconnect > millis_reconnect) {
      last_reconnect = millis();
      Serial.println("[WARNING] WiFi disconnected. Trying to reconnect.");
      connect_wifi(10000);
    }
  }
}

void led_n_on (int led_n) {
  if (config.VERSION == 1)
  {
    switch (led_n) {
      case 0:
        leds[1].setRGB( config.WEIGHTS[0],0, 0);
        break;
      case 1:
        leds[0].setRGB( 0, 0, config.WEIGHTS[1]);
        break;
      case 2:
        leds[0].setRGB( 0, config.WEIGHTS[2], 0);
        break;
      case 3:
        leds[0].setRGB( config.WEIGHTS[3], 0, 0);
        break;
      case 4:
        leds[2].setRGB( 0, config.WEIGHTS[4], 0);
        break;
      case 5:
        leds[2].setRGB( config.WEIGHTS[5], 0, 0);
        break;
      case 6:
        leds[1].setRGB( 0, 0, config.WEIGHTS[6]);
        break;
      case 7:
        leds[1].setRGB( 0, config.WEIGHTS[7], 0);
        break;
      default:
        break;
    }
    FastLED.show();
  } else {
    leds2.setBrightness(led_n,config.WEIGHTS[led_n]);
  }
}

void led_n_off (int led_n) {
  if (config.VERSION == 1) 
  {
    switch (led_n) {
      case 0:
        leds[1] = CRGB::Black;
        break;
      case 1:
        leds[0] = CRGB::Black;
        break;
      case 2:
        leds[0] = CRGB::Black;
        break;
      case 3:
        leds[0] = CRGB::Black;
        break;
      case 4:
        leds[2] = CRGB::Black;
        break;
      case 5:
        leds[2] = CRGB::Black;
        break;
      case 6:
        leds[1] = CRGB::Black;
        break;
      case 7:
        leds[1] = CRGB::Black;
        break;
      default:
        break;
    }
    FastLED.show();
  } else {
    leds2.setBrightness(led_n,0);
  }
}

String getFreeSpiffsSpacePercentage() {

  double total = SPIFFS.totalBytes();
  double used = SPIFFS.usedBytes();
  
  double freeSpace = total - used;
  double percentage = (freeSpace / total) * 100;

  char buf[10];
  dtostrf(percentage, 6, 2, buf); // Convert double to string with two decimal places
  
  return String(buf) + "%";
}