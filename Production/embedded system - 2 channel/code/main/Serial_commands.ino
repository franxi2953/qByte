void serialCommand()
{
  String cmd = Serial.readString(); 
  
  if (cmd.indexOf("wifi") > -1)
  {
    Serial_Wifi(cmd);
  } else if (cmd.indexOf("data") > -1) {
    Serial_Send_Data(cmd);
  } else if (cmd.indexOf("delete") > -1) {
    Serial_Delete_Data(cmd);
  } else if (cmd.indexOf("d&r") > -1) {
    Serial_Delete_and_Reset(cmd);
  } else if (cmd.indexOf("pd_led_map") > -1) {
    Serial_PD_Led_Map(cmd);
  } else if (cmd.indexOf("led_trial") > -1) {
    for (int i = 0; i < 8; i++)
    {
      led_n_on(i);
      delay(1000);
      led_n_off(i);
    }
  } else if (cmd.indexOf("led_party") > -1) {
    Serial_Led_Party();
  } else if (cmd.indexOf("led_boca") > -1) {
    Serial_Led_Boca();
  } else if (cmd.indexOf("temp_test") > -1) {
    Serial_Temp_Test();
  } else if (cmd.indexOf("temp") > -1) {
    Serial.println("Well 1st segment temp: " + String(calculate_temperature(WELL1)) + "\\" + " Well 2nd segment temp: " + String(calculate_temperature(WELL2)) + "\\" + " Well 3th segment temp: " + String(calculate_temperature(WELL3)) + "\\" + " Lid temp: " + String(calculate_temperature(LID)));
  } else if (cmd.indexOf("memory") > -1) {
    Serial_memory();
   } else if (cmd.indexOf("debug") > -1) {
    Serial_Change_Debug(cmd);
  } else if (cmd.indexOf("mDNS") > -1) {
    Serial_mDNS(cmd);
  } else if (cmd.indexOf("version") > -1) {
    Serial_Version(cmd);
  } else if (cmd.indexOf("update") > -1) {
    update();
  } else if (cmd.indexOf("calibration") > -1) {
    Serial_Calibration();
  } else if (cmd.indexOf("weights") > -1) {
    Serial.println("\n[INFO] Weights:");
    for (int i = 0; i < 8; i++)
    {
      Serial.println("Well " + String(i+1) + ": " + String(config.WEIGHTS[i]));
    }
  } else if (cmd.indexOf("baboom") > -1) {
    Serial.println("Baboom!");
  } else {
    Serial.println("\n[Error]Unknown command. Implemented commands:");
    Serial.println("- wifi -> Shows the registered wifi credentials");
    Serial.println("- wifi \"ssid\" \"password\" -> Set new wifi credentials");
    Serial.println("- calibration -> Perform the calibration of the system");
    Serial.println("- weights -> Shows the calibration weights of the system");
    Serial.println("- version -> Shows the version of the system");
    Serial.println("- version \"version\" -> Set new version of the system");
    Serial.println("- mDNS -> Shows the mDNS name");
    Serial.println("- mDNS \"name\" -> Set new mDNS name");
    Serial.println("- data \"filename\" -> Plot the data stored in the file \"filename\"");
    Serial.println("- delete \"filename\" -> Delete the file \"filename\" from the memory");
    Serial.println("- d&r \"filename\" -> Delete the file \"filename\" from the memory and restart the system");
    Serial.println("- pd_led_map <led> <color> -> Test mapping: 5 reads OFF + 5 reads ON per photodiode and show best match (led: 1-8 or 0-7, color: green/red/blue)");
    Serial.println("- led_trial -> Test the LEDs");
    Serial.println("- led_party -> Random LED party mode for 10 seconds");
    Serial.println("- led_boca -> 4 golden LEDs moving over a blue background (5 loops, 0.5s step)");
    Serial.println("- temp_test -> Show the temperature of all sensors (well 1, 2, 3 and lid)");
    Serial.println("- temp -> Show the temperature");
    Serial.println("- memory -> get the amount of heap memory used by the system");
    Serial.println("- debug \"true/false\"-> Change the debug mode");
    Serial.println("- update -> Check for updates, download and install them (Internet connection required)");
  }
}

void update () {
  Serial.println("\n\n[WARNING] STARTING TO UPDATE DO NOT SWITCH OFF THE DEVICE");
  if(WiFi.status() == WL_CONNECTED){
    updateSPIFFS();
    Serial.println("[INFO] File system updated. Proceeding to update firmware...");
    Serial.println("[INFO] This may take 2-5 minutes. Please do not switch off the device.");
    esp32FOTA.handle();
    Serial.println("[INFO] The firmware is up to date!");
  }
}

void Serial_Wifi (String cmd)
{
  // Find the first and second occurrences of the quotation marks
  int firstQuoteIndex = cmd.indexOf('"');
  int secondQuoteIndex = cmd.indexOf('"', firstQuoteIndex + 1);

  // Find the third and fourth occurrences of the quotation marks
  int thirdQuoteIndex = cmd.indexOf('"', secondQuoteIndex + 1);
  int fourthQuoteIndex = cmd.indexOf('"', thirdQuoteIndex + 1);

  // Check if quotes are found
  if (firstQuoteIndex != -1 && secondQuoteIndex != -1 && thirdQuoteIndex != -1 && fourthQuoteIndex != -1) {
    // Extract the ssid and password from between the quotation marks
    String ssid = cmd.substring(firstQuoteIndex + 1, secondQuoteIndex);
    String password = cmd.substring(thirdQuoteIndex + 1, fourthQuoteIndex);

    // Empty ssid or password is not valid
    if (ssid.length() == 0 || password.length() == 0) {
      Serial.println("\nSSID or password cannot be empty!");
      return;
    }

    // Save the credentials and restart
    saveCredentials(ssid, password);
    Serial.println("\n[INFO] Wifi credentials saved. Restarting the device...");
    ESP.restart();
  } else {
    // If no quotes found, then print the saved credentials
    Serial.println("\nSaved credentials");
    Serial.println("-----------------");

    char* ssid = loadCredentials()[0];
    char* password = loadCredentials()[1];
    Serial.println("ssid:" + String(ssid));
    Serial.println("pwrd:" + String(password) + "\n"); 

    // Print if wifi is connected
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWifi is connected");
    } else {
      Serial.println("\nWifi is not connected");
    }
  }
}

void Serial_Calibration () {
  // Perform the calibration
  Serial.println("\n[INFO] Calibration started...");
  calibrateFluorescence();
  Serial.println("[INFO] Calibration completed.");
}

void Serial_Send_Data (String cmd) {
  // check file name
    String file_name = cmd.substring(cmd.indexOf("\"") + 1, cmd.lastIndexOf("\""));
    // Open file with SPIFFS
    Serial.println("\n[INFO] Opening " + file_name + "...");
    File file = SPIFFS.open(file_name, "r");
    // send the data of the file
    if (file) {
      while (file.available()) {
        Serial.write(file.read());
      }
      file.close();
    } else {
      Serial.println("[ERROR] File not found");
    }
}

void Serial_Delete_Data (String cmd) {
  // check file name
    String file_name = cmd.substring(cmd.indexOf("\"") + 1, cmd.lastIndexOf("\""));
    // Open file with SPIFFS
    Serial.println("\n[INFO] Deleting " + file_name + "...");
    SPIFFS.remove(file_name);
}

void Serial_Delete_and_Reset (String cmd) {
  // check file name
    String file_name = cmd.substring(cmd.indexOf("\"") + 1, cmd.lastIndexOf("\""));
    // Open file with SPIFFS
    Serial.println("\nDeleting " + file_name + "...");
    SPIFFS.remove(file_name);
    ESP.restart();
}

void Serial_Change_Debug (String cmd) {
  // check file name
    String debug = cmd.substring(cmd.indexOf("\"") + 1, cmd.lastIndexOf("\""));
    if (debug == "true") {
      config.DEBUG = true;
      Serial.println("\n[INFO] Debug mode enabled");
      saveConfig();
    } else if (debug == "false") {
      config.DEBUG = false;
      Serial.println("\n[INFO] Debug mode disabled");
    } else {
      Serial.println("\n[ERROR] Unknown option. Implemented options:");
      Serial.println("- debug \"true/false\"");
    }
}

void Serial_Version (String cmd) {
  //count number of spaces in the string
    int spaces = 0;
    for (int i = 0; i < cmd.length(); i++)
    {
        if (cmd[i] == ' ')
        {
          spaces++;
        }
    }
  
    if (spaces == 1)
    {
      // get ssid from the string between the first and the second "
      String version = cmd.substring(cmd.indexOf('"') + 1, cmd.indexOf('"', cmd.indexOf('"') + 1));

      Serial.println("\n[INFO] Version changed to " + version + ". \nRestarting the device...");
      
      // version as an int
      config.VERSION = version.toInt();
      saveConfig();
      ESP.restart();
      
    } else {
      Serial.println("version:" + String(config.VERSION) + "\n"); 
    }
}

void Serial_mDNS (String cmd) {
  //count number of spaces in the string
    int spaces = 0;
    for (int i = 0; i < cmd.length(); i++)
    {
        if (cmd[i] == ' ')
        {
          spaces++;
        }
    }
  
    if (spaces == 1)
    {
      // get ssid from the string between the first and the second "
      String mDNS = cmd.substring(cmd.indexOf('"') + 1, cmd.indexOf('"', cmd.indexOf('"') + 1));

      //free ESP32mDNS host
      MDNS.end();


      // check if the new mDNS name is already in use
      if (MDNS.queryHost(mDNS.c_str()) == IPAddress(0, 0, 0, 0)) {
        Serial.println("\n[INFO] mDNS name changed to " + mDNS + ". \nRestarting the device...");
        config.mDNS = mDNS;
        saveConfig();
        ESP.restart();
      } else {
        Serial.println("\n[ERROR] mDNS name already in use");
      } 
      
    } else {
      Serial.print("\nSaved mDNS name: ");
      Serial.println("http://" + config.mDNS + ".local" + "\n"); 

      // print IP
      Serial.println("IP address: " + WiFi.localIP().toString());
      
    }
}

void Serial_memory ()
{
  Serial.println("\n[INFO] Memory usage:");
  Serial.println("SPIFFS enabled memory: " + String(SPIFFS.totalBytes()) + " bytes");
  Serial.println("SPIFFS used memory: " + String(SPIFFS.usedBytes()) + " bytes");
  Serial.println("SPIFFS free memory: " + String(SPIFFS.totalBytes() - SPIFFS.usedBytes()) + " bytes, " + String((SPIFFS.totalBytes() - SPIFFS.usedBytes()) * 100 / SPIFFS.totalBytes()) + "%");
}

bool isNumericToken(String token)
{
  token.trim();
  if (token.length() == 0) {
    return false;
  }

  for (int i = 0; i < token.length(); i++) {
    if (!isDigit(token.charAt(i))) {
      return false;
    }
  }

  return true;
}

void Serial_PD_Led_Map(String cmd)
{
  String args = cmd;
  int firstSpace = args.indexOf(' ');

  if (firstSpace == -1) {
    Serial.println("\n[ERROR] Missing arguments. Usage: pd_led_map <led> <color>");
    Serial.println("[INFO] Example: pd_led_map 3 green");
    return;
  }

  args = args.substring(firstSpace + 1);
  args.trim();

  int secondSpace = args.indexOf(' ');
  if (secondSpace == -1) {
    Serial.println("\n[ERROR] Missing color. Usage: pd_led_map <led> <color>");
    return;
  }

  String ledToken = args.substring(0, secondSpace);
  String colorToken = args.substring(secondSpace + 1);
  ledToken.trim();
  colorToken.trim();
  colorToken.replace("\"", "");
  colorToken.toLowerCase();

  if (!isNumericToken(ledToken)) {
    Serial.println("\n[ERROR] LED index must be numeric (1-8 or 0-7).");
    return;
  }

  int ledInput = ledToken.toInt();
  int targetLed = -1;

  if (ledInput >= 1 && ledInput <= 8) {
    targetLed = ledInput - 1;
  } else if (ledInput >= 0 && ledInput <= 7) {
    targetLed = ledInput;
  } else {
    Serial.println("\n[ERROR] LED index out of range. Use 1-8 or 0-7.");
    return;
  }

  int colorIdx = -1;
  if (colorToken == "blue") {
    colorIdx = 0;
  } else if (colorToken == "red") {
    colorIdx = 1;
  } else if (colorToken == "green") {
    colorIdx = 2;
  } else {
    Serial.println("\n[ERROR] Invalid color. Use green, red or blue.");
    return;
  }

  const int samples = 5;
  float avgOff[8] = {0};
  float avgOn[8] = {0};
  float delta[8] = {0};

  // Ensure all LEDs are off before the test.
  for (int i = 0; i < 8; i++) {
    int mapped = (config.VERSION == 3) ? (7 - i) : i;
    leds_blue.setBrightness(mapped, 0);
    leds_red.setBrightness(mapped, 0);
    leds_green.setBrightness(mapped, 0);
  }

  Serial.println("\n[INFO] Starting photodiode mapping test");
  Serial.println("[INFO] LED: " + String(targetLed + 1) + " | color: " + colorToken + " | samples per state: " + String(samples));

  for (int pd = 0; pd < 8; pd++) {
    float sumOff = 0;
    float sumOn = 0;

    for (int k = 0; k < samples; k++) {
      sumOff += calculate_fluorescence(pd);
      delayMicroseconds(config.FLUO_DELAY_US);
    }

    led_n_on_color(targetLed, colorIdx);
    delay(5);

    for (int k = 0; k < samples; k++) {
      sumOn += calculate_fluorescence(pd);
      delayMicroseconds(config.FLUO_DELAY_US);
    }

    led_n_off_color(targetLed, colorIdx);

    avgOff[pd] = sumOff / samples;
    avgOn[pd] = sumOn / samples;
    delta[pd] = avgOn[pd] - avgOff[pd];
  }

  int bestPd = 0;
  float bestDelta = delta[0];
  for (int pd = 1; pd < 8; pd++) {
    if (delta[pd] > bestDelta) {
      bestDelta = delta[pd];
      bestPd = pd;
    }
  }

  Serial.println("\n[RESULT] Photodiode response (OFF avg, ON avg, ON-OFF):");
  for (int pd = 0; pd < 8; pd++) {
    Serial.println(
      "PD " + String(pd + 1) +
      " -> off=" + String(avgOff[pd], 3) +
      " on=" + String(avgOn[pd], 3) +
      " delta=" + String(delta[pd], 3)
    );
  }

  Serial.println("[RESULT] Most probable photodiode for LED " + String(targetLed + 1) + " (" + colorToken + "): PD " + String(bestPd + 1) + " with delta=" + String(bestDelta, 3));
}

void Serial_Temp_Test ()
{
  // Mirrors calculate_resistance() + temperature_model() with every intermediate value exposed.
  // MUX truth (as coded, not the comment which differs):
  //   sensor 0 WELL1: SW1=L SW2=L
  //   sensor 1 WELL2: SW1=H SW2=L
  //   sensor 2 WELL3: SW1=L SW2=H
  //   sensor 3 LID:   SW1=H SW2=H
  const char* sensor_names[] = {"Well 1", "Well 2", "Well 3", "Lid"};
  const uint8_t sw1_vals[]   = { LOW,      HIGH,     LOW,      HIGH };
  const uint8_t sw2_vals[]   = { LOW,      LOW,      HIGH,     HIGH };

  // Steinhart-Hart coefficients (same as temperature_model)
  const float a = 0.8765862969e-3;
  const float b = 2.830974426e-4;
  const float c = -1.427358166e-07;

  Serial.println("\n[INFO] Verbose temperature readings:");
  PD_array.setGain(GAIN_ONE);

  for (int s = 0; s < 4; s++) {
    digitalWrite(SW1, sw1_vals[s]);
    digitalWrite(SW2, sw2_vals[s]);
    delay(10); // let MUX settle

    int16_t adc_raw      = PD_array.readADC_SingleEnded(2);
    float   voltage      = (adc_raw * 0.125f) / 1000.0f;           // mV/bit → V
    float   resistance_k = (SERIES_RESISTOR * voltage) / (5.0f - voltage); // kΩ
    float   resistance   = resistance_k * 1000.0f;                  // Ω (input to Steinhart-Hart)
    float   logR         = log(resistance);
    float   temperature  = (1.0f / (a + b*logR + c*logR*logR*logR)) - 273.15f;

    Serial.println("\n--- " + String(sensor_names[s]) + " ---");
    Serial.println("  ADC raw:       " + String(adc_raw) + " counts");
    Serial.println("  Voltage:       " + String(voltage, 5) + " V");
    Serial.println("  Resistance:    " + String(resistance_k, 4) + " kOhm  (" + String(resistance, 1) + " Ohm)");
    Serial.println("  Temperature:   " + String(temperature, 2) + " C");
  }

  Serial.println("\n--- PWM outputs ---");
  Serial.println("  Well 1: " + String(DATA_PID_1) + " / 255");
  Serial.println("  Well 2: " + String(DATA_PID_2) + " / 255");
  Serial.println("  Well 3: " + String(DATA_PID_3) + " / 255");
  Serial.println("  Lid:    " + String(DATA_PID_LID) + " / 255");
}

void Serial_Led_Party ()
{
  Serial.println("\n[INFO] LED party mode started (10 seconds)...");
  for (int iter = 0; iter < 20; iter++)
  {
    for (int led = 0; led < 8; led++)
    {
      int mapped_led = (config.VERSION == 3) ? (7 - led) : led;
      leds_blue.setBrightness(mapped_led,  random(2) ? config.WEIGHTS[led] : 0);
      leds_red.setBrightness(mapped_led,   random(2) ? config.WEIGHTS[led] : 0);
      leds_green.setBrightness(mapped_led, random(2) ? config.WEIGHTS[led] : 0);
    }
    delay(500);
  }
  // Turn all LEDs off after party
  for (int led = 0; led < 8; led++)
  {
    int mapped_led = (config.VERSION == 3) ? (7 - led) : led;
    leds_blue.setBrightness(mapped_led,  0);
    leds_red.setBrightness(mapped_led,   0);
    leds_green.setBrightness(mapped_led, 0);
  }
  Serial.println("[INFO] LED party mode completed.");
}

void Serial_Led_Boca ()
{
  Serial.println("\n[BOCA] Dale booo, jefe! Arranca la mistica bostera!");
  Serial.println();
  Serial.println("           _._._._._._._._._._._._._._");
  Serial.println("          /  *  *  *  *  *  *  *  *   \\");
  Serial.println("         /   *      B O C A      *    \\");
  Serial.println("        /    *   A T L E T I C O   *   \\");
  Serial.println("       /     *   J U N I O R S     *    \\");
  Serial.println("      /      *   *   C A B J   *   *     \\");
  Serial.println("      \\      *   *   *   *   *   *     //");
  Serial.println("       \\     *   *   *   *   *   *    //");
  Serial.println("        \\    *   *   *   *   *   *   //");
  Serial.println("         \\   *   *   *   *   *   *  //");
  Serial.println("          \\_________________________//");
  Serial.println("              X E N E I Z E  M O D E");

  Serial.println("\n[INFO] LED boca mode started (5 loops, 0.5s step)...");

  const int ledCount = 8;
  const int goldCount = 4;
  const int stepDelayMs = 500;
  const int loops = 5;
  const char* chants[] = {
    "Dale Bo, dale Bo!",
    "Esto es BOCA, papa!",
    "La Bombonera late.",
    "Xeneize de corazon.",
    "Maradona eterno.",
    "Azul y oro para siempre.",
    "Boca, Boca y siempre Boca!"
  };
  const int chantCount = sizeof(chants) / sizeof(chants[0]);
  int halfStepCount = 0;
  int chantIdx = 0;

  for (int loop = 0; loop < loops; loop++)
  {
    // Start with all LEDs blue.
    for (int i = 0; i < ledCount; i++)
    {
      int mapped = (config.VERSION == 3) ? (7 - i) : i;
      int base = constrain((int)round(config.WEIGHTS[i]), 0, 255);
      leds_blue.setBrightness(mapped, base);
      leds_red.setBrightness(mapped, 0);
      leds_green.setBrightness(mapped, 0);
    }
    delay(stepDelayMs);
    halfStepCount += 1;
    if ((halfStepCount % 2) == 0)
    {
      Serial.println(String("[BOCA] ") + chants[chantIdx % chantCount]);
      if ((chantIdx % 3) == 0)
      {
        Serial.println("        .- CABJ -.");
      }
      if ((chantIdx % 4) == 0)
      {
        Serial.println("   * * * * * * * * * * * * *");
        Serial.println("   =========================");
        Serial.println("   ==  *  C A B J  *  *   ==");
        Serial.println("   =========================");
      }
      chantIdx += 1;
    }

    // Move a 4-LED golden window from left to right.
    for (int start = -goldCount; start <= ledCount; start++)
    {
      for (int i = 0; i < ledCount; i++)
      {
        int mapped = (config.VERSION == 3) ? (7 - i) : i;
        int base = constrain((int)round(config.WEIGHTS[i]), 0, 255);
        bool isGold = (i >= start) && (i < start + goldCount);

        if (isGold)
        {
          // Gold ~= strong red + medium green.
          int goldRed = base;
          int goldGreen = constrain((int)round(base * 0.62f), 0, 255);
          leds_blue.setBrightness(mapped, 0);
          leds_red.setBrightness(mapped, goldRed);
          leds_green.setBrightness(mapped, goldGreen);
        }
        else
        {
          // Blue background.
          leds_blue.setBrightness(mapped, base);
          leds_red.setBrightness(mapped, 0);
          leds_green.setBrightness(mapped, 0);
        }
      }
      delay(stepDelayMs);
      halfStepCount += 1;
      if ((halfStepCount % 2) == 0)
      {
        Serial.println(String("[BOCA] ") + chants[chantIdx % chantCount]);
        if ((chantIdx % 3) == 0)
        {
          Serial.println("        .- CABJ -.");
        }
        if ((chantIdx % 4) == 0)
        {
          Serial.println("   * * * * * * * * * * * * *");
          Serial.println("   =========================");
          Serial.println("   ==  *  C A B J  *  *   ==");
          Serial.println("   =========================");
        }
        chantIdx += 1;
      }
    }
  }

  // End with all LEDs off.
  for (int i = 0; i < ledCount; i++)
  {
    int mapped = (config.VERSION == 3) ? (7 - i) : i;
    leds_blue.setBrightness(mapped, 0);
    leds_red.setBrightness(mapped, 0);
    leds_green.setBrightness(mapped, 0);
  }

  Serial.println("[INFO] LED boca mode completed.");
}