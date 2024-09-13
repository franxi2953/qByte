float calculate_fluorescence (int well_n)
{
  

  // no interrupt during the measurement
  float fluo_pd = 0;
  
  if (config.VERSION == 1)
  {
    switch (well_n)
    {
      case 0:
        digitalWrite(SW1, LOW);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(0);
        break;
      case 1:
        digitalWrite(SW2, LOW);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(1);
        break;
      case 2:
        digitalWrite(SW1, HIGH);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(0);
        break;
      case 3:
        digitalWrite(SW2, HIGH);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(1);
        break;
      case 4:
        digitalWrite(SW3, LOW);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(2);
        break;
      case 5:
        digitalWrite(SW4, LOW);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(3);
        break;
      case 6:
        digitalWrite(SW3, HIGH);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(2);
        break;
      case 7:
        digitalWrite(SW4, HIGH);
        delay(50);
        fluo_pd = PD_array.readADC_SingleEnded(3);
        break;
      default:
        fluo_pd = -1;  
        break;
      }
  } else {
      switch (well_n)
      {
        case 0:
          //Set up the MUX
          digitalWrite(SW1, LOW);
          digitalWrite(SW2, LOW);
          digitalWrite(SW3, LOW);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);

          break;
        case 1:
          //Set up the MUX
          digitalWrite(SW1, HIGH);
          digitalWrite(SW2, LOW);
          digitalWrite(SW3, LOW);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 2:
          //Set up the MUX
          digitalWrite(SW1, LOW);
          digitalWrite(SW2, HIGH);
          digitalWrite(SW3, LOW);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 3:
          //Set up the MUX
          digitalWrite(SW1, HIGH);
          digitalWrite(SW2, HIGH);
          digitalWrite(SW3, LOW);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 4:
          //Set up the MUX
          digitalWrite(SW1, LOW);
          digitalWrite(SW2, LOW);
          digitalWrite(SW3, HIGH);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 5:
          //Set up the MUX
          digitalWrite(SW1, HIGH);
          digitalWrite(SW2, LOW);
          digitalWrite(SW3, HIGH);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 6:
          //Set up the MUX
          digitalWrite(SW1, LOW);
          digitalWrite(SW2, HIGH);
          digitalWrite(SW3, HIGH);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        case 7:
          //Set up the MUX
          digitalWrite(SW1, HIGH);
          digitalWrite(SW2, HIGH);
          digitalWrite(SW3, HIGH);
          delay(50);
          // read the adc value
          fluo_pd = PD_array.readADC_SingleEnded(1);
          break;
        default:
          fluo_pd = -1;  
          break;
        }

    }
  return fluo_pd;
}

float calculate_resistance (int sensor)
{
  // no interrupt during the measurement

  float voltage;
  float resistance;

  if (config.VERSION == 1)
  {
    //Read ADC and transform into voltage
    voltage = analogRead(temp_pin[sensor]) * (3.300000 /*adc max volts*/ / 4096 /*max adc value*/);
  } else {
    // set up multiplexor with PINS SW1, SW2
    // truth table
    // SW1 SW2 sensor
    // 0   0   WELL1
    // 0   1   WELL2
    // 1   0   WELL3
    // 1   1   LID

    // set up the multiplexor
    switch (sensor)
    {
      case 0:
        digitalWrite(SW1, LOW);
        digitalWrite(SW2, LOW);
        break;
      case 1:
        digitalWrite(SW1, HIGH);
        digitalWrite(SW2, LOW);
        break;
      case 2:
        digitalWrite(SW1, LOW);
        digitalWrite(SW2, HIGH);
        break;
      case 3:
        digitalWrite(SW1, HIGH);
        digitalWrite(SW2, HIGH);
        break;
      default:
        break;
    }

    // set gain to one 
    PD_array.setGain(GAIN_ONE);
    voltage = (PD_array.readADC_SingleEnded(2) * 0.125)/1000;

  }


  //Voltage to resistance calculation
  resistance = ( SERIES_RESISTOR * voltage) / (5 /*Vcc*/ - voltage);
  return resistance;
  
}

float calculate_temperature (int sensor)
{
  //Resistance to temperature
  float measured_resistance = calculate_resistance(sensor)*1000;

  return temperature_model(measured_resistance, sensor);
}


float temperature_model(float measured_resistance, int sensor)
{

  //https://www.thinksrs.com/downloads/programs/Therm%20Calc/NTCCalibrator/NTCcalculator.htm
  float a = 0.8765862969e-3;
  float b = 2.830974426e-4;
  float c = -1.427358166e-07;

  float LogR = log(measured_resistance);

  float result = (1.0 / (a + b*LogR + c*LogR*LogR*LogR))-273.15;
  
  return result;

}
