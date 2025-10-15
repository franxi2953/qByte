![open_qLAMP](../Photos/diagram_only_qlamp.png)


# Index

[TOC]

# Paper Reference

qByte: An open-source isothermal fluorimeter for democratizing analysis of nucleic acids, proteins and cells
Quero FJ, Aidelberg G, Vielfaure H, Huon de Kermadec Y, Cazaux S, et al. (2025) qByte: An open-source isothermal fluorimeter for democratizing analysis of nucleic acids, proteins and cells. PLOS Biology 23(5): e3003199. https://doi.org/10.1371/journal.pbio.3003199

# Introduction 

Accessibility to scientific and diagnostic instrumentation is one of the main bottlenecks in the implementation of global health and decentralized science. The advancement of digital fabrication techniques and the cheapening of electronic prototyping have facilitated the emergence of open source prototypes that lower the cost of entry of these technologies. However, despite the importance of these prototypes for making the hands-on biotechnology more ubiquitous, they rarely move from the prototyping phase to their actual implementation, with their subsequent adaptation to mass production and validation in real scenarios. This is particularly relevant in the field of nucleic acid amplification, the gold standard in the field of diagnostics and biosensing. Despite relevant open-source products that allow nucleic acid amplification (as [PocketPCR](https://gaudi.ch/PocketPCR/) or [NinjaPCR](https://ninjapcr.tori.st/)) their results still require a subsequent analysis by electrophoresis gels or an end-point examination with a transilluminator. 

Here we describe the design and mid-scale production of the Open qLAMP, a device that, for a manufacturing cost of less than 50€, allows real-time detection of nucleic acid amplifications. We also include data that, together with our <2$ [in-house produced LAMP reactions](https://www.protocols.io/view/corona-detective-user-protocol-v2-0-14egnzbyqg5d/v2), validate the device for the detection of numerous targets, including SARS-CoV-2 clinical samples in resource constrained regions, presence of GMO elements in commercial food and the early detection of fungal infestation on chestnut plantations. Finally, we present results on how this system also has great potential in other fields such as enzyme activity characterization, protein production in cell-free extracts or antibiotic resistance screening in bacterial samples.


# Quick start

This is a quick guide to follow if you received an already assembled and programmed qLAMP / qByte. For a complete assembly guide please follow the [making the device](#making-the-device) section.

1. Connect the device to your computer and open the [serial monitor in the Arduino IDE](https://docs.arduino.cc/software/ide-v2/tutorials/ide-v2-serial-monitor/) (other serial monitors should also work). At the moment, there are some plugins for the ESP32 (like the SPIFFS Filesystem Uploader Plugin) that are not yet supported on Arduino 2. As qByte uses the SPIFFS plugin, we recommend installing the legacy version 1.8.X 

2. Follow [these instructions](https://randomnerdtutorials.com/installing-the-esp32-board-in-arduino-ide-windows-instructions/) to download and install the esp32 board.

3. Ensure that the correct board and COM port are selected in the drop down at the top of screen, choose "Select Other Board and Port" if not. The board is DOIT ESP32 DEVKIT V1. If using a serial monitor other than the Arduino IDE it may _only_ be necessary to set the COM port number. If using Windows, you can find the COM port number by identifying the device in [Device Manager](https://www.lifewire.com/device-manager-2625860) > Ports (COM & LPT). It will be listed as Silicon Labs CP210x USB to UART Bridge. Instructions for finding the COM port on other operating systems can be found [here](https://www.mathworks.com/help/matlab/supportpkg/find-arduino-port-on-windows-mac-and-linux.html). If you don’t see the COM Port in your Arduino IDE, you need to install the [CP210x USB to UART Bridge VCP Drivers](https://www.silabs.com/products/development-tools/software/usb-to-uart-bridge-vcp-drivers).

4. Check the baud rate. The baud rate of the ESP32-WROOM-32 by Espressif Systems, like most ESP32 devices, is 152000. If you see nonsense in the serial monitor, most likely the baud rate is incorrect. Set it in the right dropdown menu in the serial monitor.

5. Configure the device's Wi-Fi by sending the command: wifi "ssid" "password" (including the quotes) via the serial monitor prompt. The device will restart and connect to a Wi-Fi network. _**Note:** The local network should allow devices to communicate with each other but does not need to be connected to the internet._

6. Connect to the same Wi-Fi network on your computer or mobile device.

7. Open a web browser and enter in the following URL: http://qlamp.local. If you want to change the URL, use the serial command: mDNS "newURL" (replace "newURL" with the desired URL. Do NOT include ".local" suffix). The device will restart and be available at the new URL. To check the current URL, use the serial command: mDNS.

8. The webpage should load within 30 seconds. If not, try reloading the page or changing the local network.

**Webpage Modes:**

```diff
1. Experiment Design:

   1. Assign conditions (e.g., negative/positive control, drug concentration) to each of the 8 tube strips.
   2. Assign colors to each condition.
   3. Experiment Run (two modes available):

```

```diff
2. Experiment Run:
   
   Control the parameters of the reaction and launch the protocol. 
   The device work in two different modes, which can be selected by a switch right above the "Run" button: 
   
   1. Normal Mode:
      1. Select time, temperature, space between readings, and heated lid temperature.
      2. Run the experiment as designed.
   2. Melting Curve Mode:
      1. Select time, temperature range, temperature increment, and time for each temperature step.
      2. The device will increase the temperature linearly.
      3. Run the experiment.
```

```diff
3. Analysis:

  Once the experiment is finished, you can download the data in a JSON file or .CSV file.
  Aditionally there are two implemented analysis options:

  1. Ct Value: Select a fluorescence threshold by clicking on the graph. The time for each sample to reach the threshold will be displayed.
  2. Melting curve: The graph will show the negative of the fluorescence change rate (-dF/dT) as a function of temperature.
```

```diff
4. Calibration:

  Reserved for sensor calibration (temperature and fluorescence).
  Observe resistance evolution of temperature sensors.
  Enter the actual temperature values measured with an external sensor.
  Download the data for further analysis.
```

Note: For any issues or questions, refer to the serial monitor for additional commands or consult the device's documentation.

# Making the device

![Assembly](../Photos/qLAMP%20assembly%20diagram.png)

1. Assembly the device according to the blueprints described in the [components](#Components) section.

2. Install the [Arduino IDE](https://www.arduino.cc/en/software) 1.8.1, ready to upload the code and the [SPIFFS](https://randomnerdtutorials.com/install-esp32-filesystem-uploader-arduino-ide/) files to the ESP32.

3. The microcontroller is the ESP32-WROOM-32 by Espressif Systems but it may appear in the IDE as DOIT ESP32 DEVKIT V1. Go to the Tools > Board > Boards Manager menu. A searchable list of installable packages should appear in a sidebar. Install ESP32 by Espressif Systems board manager version 1.0.6.

4. Go to Tools > Library Manager or click the books icon in the sidebar of the IDE. Install the following libraries and versions:
      - FastLED library version 3.5.0.
      - PID_v2 library by Brett Beauregard version 2.0.1.
      - ArduinoJson library version 6.17.2.
      - SPIFFS file system size: Default 4MB with SPIFFS (1.2MB APP/1.5MB SPIFFS).
      - Math library.

5. Download all the libraries included in .zip files of the folder "[/qByte/Production/embedded%20system/libraries](https://gitlab.com/open-bioeconomy-lab/diagnostics-hardware/rt-lamp-device/-/tree/master/qByte/Production/embedded%20system/libraries?ref_type=heads)" of this repository. In the Arduino IDE, navigate to Sketch > Include Library > Add .ZIP Library. At the top of the drop down list, select the option to "Add .ZIP Library''. See more [detailed instructions here](https://docs.arduino.cc/software/ide-v1/tutorials/installing-libraries/).

6.  Follow the [quick start](#quick-start) section.

# Results
<details>
  <summary markdown="span">SARS-CoV-2 amplification with SYTO 9</summary>
    <div align="center"><img src ="../Photos/covid_plot.png" width=70%/></div>
</details>

<details>
  <summary markdown="span">Enzyme activity characterization with melting curve analysis</summary>
    ![Enzyme activity](../Photos/Enzyme_activity.png)
    <div align="center"><img src ="../Photos/Melting_curve.png" width=60%/></div>
</details>


<details>
  <summary markdown="span">Fungal concentration detection in chestnut samples</summary>
    <div align="center"><img src ="../Photos/cinammomi.png" width=70%/></div>
</details>

<details>
  <summary markdown="span">Typhoid detection with CRISPR/Cas12</summary>
    <div align="center"><img src ="../Photos/CRISPR.png" width=90%/></div>
</details>


# Components
## Costs

![Costs](../Photos/qLAMP costs.png)

## Electronics

![Electronics](../Photos/diagram_only_sch.png)

Find them at [Open Source Hardware Lab](https://oshwlab.com/franxi2953/open-qlamp).

## Code

The latest version can be found in this repository (folder "\ESP32\main").

In general, the code working principles are the following:
- The device have an internal [SPIFFS file system](https://randomnerdtutorials.com/install-esp32-filesystem-uploader-arduino-ide/) storage where the protocol data, the webpage with the UI and the credentials for the wifi are stored.
- The device connects to a local network that is configurable by the serial command *wifi "ssid" "password"*. The local network should allow devices to talk between each other but **do not need to be connected to the internet**.
- Thanks to mDNS, the device can always be found at the "qlamp.local/" URL in any device connected to the same local network. If the user wants to change the URL, it can be done by the serial command *mDNS "newURL"*, where "newURL" is the first part of the desired URL before the ".local" sufix. The device will restart and will bne available in the new URL. To check the current URL, the user can use the serial command *mDNS*.
- Once a computer connected to the same local network tries to access the device through the URL mentioned above, the device will provide the webpage stored in the SPIFFS file system. This webpage can be found in the repository's folder "\ESP32\main\data". 
- The webpage provides simple ways of controlling the machine. We are still working on new functionalities, and all the help coding is hugely welcomed!

## Case

The latest version of the case can be found at the [OnShape Repository](https://cad.onshape.com/documents/fce8700b3c8f4038beef7327/w/66fbe211cbfcb16be40ce314/e/4a9a59be1c3a1e21a01af985?renderMode=0&uiState=627f9f3b91918f0016f76398). 

The following parts should be printed as follows:
- The "case_top" and the "cap" should be printed in PLA, one single piece, with 0.2mm of layer height. Be careful using an excess of supports or the hinge won't move.
- The "case_bottom" part should be printed in PLA. It can be printed with less precision than the previous part.
- The "intermediate" should be printed in PETG or any material with a glass transition of more than 63ºC. Lately we have started cutting it in black 1mm acrylic.

After printing/cutting the plastitc separator, with the help of some double side tape on the borders, attach a piece of [738 JAS Green Lee Filter](https://leefilters.com/colour/738-jas-green/) or [179 Chrome Orange Lee Filter](https://leefilters.com/colour/179-Chrome-Orange/) to filter the emiting light from the signal before the sensing unit.

![GCODE_example](../Photos/gcode%20example.PNG)


# To-Dos

# Funding
This project is funded by the Learning Planet Institute, the Tsinghua-Cambridge collaborative grant for Covid diagnosis and the Gathering for Open Science Hardware (GOSH) collaborative development funds 2022.

Thanks you all for making this possible!

# License

![GCODE_example](../Photos/oshw_facts.svg)
