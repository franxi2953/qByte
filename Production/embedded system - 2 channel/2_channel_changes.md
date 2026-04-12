# 2-Channel System Changes & Implementation Plan

## Hardware & Pin Updates
- [ ] **Microcontroller**: ESP32S3 Dev Module
- [x] **Heater PWM Pins** (Updated in `main.ino`):
  - PWM_1: 33
  - PWM_2: 34
  - PWM_3: 35
  - PWM_LID: 36
- [ ] **I2C Bus**:
  - SDA: Pin 3
  - SCL: Pin 2
- [ ] **RGB LEDs (TLC59108)**: Independent brightness parameters per color setup at max intensity initially.
  - Blue: I2C `0x40`
  - Red: I2C `0x41`
  - Green: I2C `0x42`
- [ ] **Multiplexer (MUX)**:
  - SW1: Pin 5
  - SW2: Pin 6
  - SW3: Pin 7

## Sensor Reading (2 Diodes)
- [ ] Channel 1: Reads as before via MUX (`ADC AIN1`).
- [ ] Channel 2: Reads simultaneously via MUX (`ADC AIN3`).
- [ ] **Auto-gain Handling**: 48 independent auto-gain trackers (8 tubes * 3 colors * 2 channels) implemented.

## Cycle & Data Storage
- [ ] **Configuration (`config.txt`)**: Set up mapped color filters for each channel (e.g., JAS Green, 105 ORANGE) to be selected in UI. Assign default LED brightness intensities here as well.
- [ ] **Cycle Sequence**: For each of the 8 tubes, iterate through 3 light channels (Blue, Red, Green). At each step, read both photodiodes (AIN1, AIN3).
- [ ] **Storage Format**: Store a standardized set of 48 values per read cycle into the CSV format.
- [ ] **Peripheral Code Adaptation**: Refactor small commands like `led_trial` to independently test each LED and color sequentially.

## User Interface (`/code/main/data`)
- [ ] **Data Parsing**: Adapt JS CSV parsing for the new 48-variable structure.
- [ ] **Graph Display**: Update charts so the center of the point reflects the color of the channel, while the point's border identifies the sample.
- [ ] **Analysis Tab Tools**:
  - [ ] Allow viewing data from any combination of Light (LED color) + Diode.
  - [ ] Retain current normalization selections.
  - [ ] Introduce cross-channel normalization math (e.g., divide Blue Light Diode 1 by Red Light Diode 2).



