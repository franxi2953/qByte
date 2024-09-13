//Open quantitative LAMP device for isothermal amplifications
//https://dl.espressif.com/dl/package_esp32_index.json

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPmDNS.h>
#include <FastLED.h>
#include <Wire.h>
#include <TLC59108.h>
#include "src/analogWrite.h"
#include <Adafruit_ADS1X15.h>
#include <Adafruit_TLA202x.h>
#include <PID_v2.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <SPIFFS.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <Math.h>
#include <esp32FOTA.hpp>
#include <HTTPClient.h>

String V_SOFTWARE = "1.0.3";
String UPDATE_SERVER = "updateqbyte.ngrok.app";

#define NUM_LEDS 3
#define DATA_PIN 27

//define int constants for using the segment names instead of numbers
#define WELL1 0
#define WELL2 1
#define WELL3 2
#define LID 3

#define SERIES_RESISTOR 10


struct config_t {
  String mDNS = "qLAMP";
  unsigned int CYCLE_TIME = 60000;
  bool DEBUG=true;
  float WEIGHTS[8] = {255.00,255.00,255.00,255.00,255.00,255.00,255.00,255.00};
  int LID_DIFFERENCE = 5;
  int LID_TEMP = 95;
  int MELTING_RANGE[2] = {50,95}; //The temperature at which the melting curve starts. 
  float MELTING_STEP = 0.2; //The temperature step of the melting curve.
  int MELTING_TIME = 10000; //The time at which the melting curve is at a given temperature.
  int VERSION = 1;
} config;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// LEDs control (version 1)
CRGB leds[NUM_LEDS];

Adafruit_ADS1115 PD_array;

//LEDs control (version 2)
TLC59108 leds2(0x40);

//WEBSERVER
AsyncWebServer server(80);


//variables to reconnect to the wifi
int millis_reconnect = 60000;
long int last_reconnect = 0;

//HEATING
#define PWM_1 23
#define PWM_2 19
#define PWM_3 18
#define PWM_LID 5

int temp_pin[5] = {32,33,34,35,36}; //{wells_segment_1, wells_segment_2, wells_segment_3, lid, room temp};
int mean_temp = 0;
float heater_goal = 0;

int DATA_PID_1 = 0;
int DATA_PID_2 = 0;
int DATA_PID_3 = 0;
int DATA_PID_LID = 0;


#define PID_SAMPLE 100 //ms
double Kp = 30, Ki = 0.1, Kd = 0.1;
PID_v2 PWM_PID_1(Kp, Ki, Kd, PID::Direct);
PID_v2 PWM_PID_2(Kp, Ki, Kd, PID::Direct);
PID_v2 PWM_PID_3(Kp, Ki, Kd, PID::Direct);
PID_v2 PWM_PID_LID(Kp, Ki, Kd, PID::Direct);

//FLUORESCENCE READING
#define SW1 16
#define SW2 17
#define SW3 26
#define SW4 25

#define GAIN GAIN_FOUR

int variable_gain[] = {0,0,0,0,0,0,0,0}; //to store the gain of each channel
adsGain_t gain_dict[] = {GAIN_SIXTEEN, GAIN_EIGHT, GAIN_FOUR, GAIN_TWO,GAIN_ONE, GAIN_TWOTHIRDS}; //to translate the gain to the constants
float step_dict[] = {0.0078125, 0.015625, 0.03125, 0.0625, 0.125, 0.1875}; // to transform the reading to mV

//Protocol
long int last_cycle_time = 0; //To control the entrance in a new cycle of measurement
long int last_melting_cycle_time = 0; //To control the entrance in a new cycle of measurement in the melting
bool OnGoing = false; //Is there an experiment in progress?
bool OnGoingMelting = false; //Is there a melting curve in progress?
long int time_before_interruption = 0; //If the experiment was interrupter, the time before the interruption. Otherwise, 0.
long start_time = 0; //The time when the experiment started.
int melting_temp; //the variable to store the temperature during the experiment.
bool last_cycle_melting = false; //Is the last cycle of the experiment a melting curve?

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

esp32FOTA esp32FOTA("qbyte", V_SOFTWARE);

void setup() {
  Initialize();  
}

void loop() {

  if (Serial.available())
    serialCommand();
      

  //Check if wifi is connected, try to reconnect if not.
  check_wifi();

  //Keeping the temperature
  runPID();

  //keeping the fluorescent reading cycles and data storage
  PerformCycle();
  PerformMelting();
}


