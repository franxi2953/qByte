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
  } else if (cmd.indexOf("led_trial") > -1) {
    for (int i = 0; i < 8; i++)
    {
      led_n_on(i);
      delay(1000);
      led_n_off(i);
    }
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
  } else if (cmd.indexOf("baboom") > -1) {
    Serial.println("Baboom!");
  } else {
    Serial.println("\n[Error]Unknown command. Implemented commands:");
    Serial.println("- wifi -> Shows the registered wifi credentials");
    Serial.println("- wifi \"ssid\" \"password\" -> Set new wifi credentials");
    Serial.println("- version -> Shows the version of the system");
    Serial.println("- version \"version\" -> Set new version of the system");
    Serial.println("- mDNS -> Shows the mDNS name");
    Serial.println("- mDNS \"name\" -> Set new mDNS name");
    Serial.println("- data \"filename\" -> Plot the data stored in the file \"filename\"");
    Serial.println("- delete \"filename\" -> Delete the file \"filename\" from the memory");
    Serial.println("- d&r \"filename\" -> Delete the file \"filename\" from the memory and restart the system");
    Serial.println("- led_trial -> Test the LEDs");
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