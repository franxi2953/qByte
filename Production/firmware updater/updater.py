import os
import glob
import sys
import subprocess
import serial
import time
import serial.tools.list_ports
from shutil import which

# detect Python command
def detect_python():
    python_commands = ['python', 'python3', 'py']
    for python_command in python_commands:
        if which(python_command) is not None:
            return python_command
    raise EnvironmentError("Python interpreter is not found.")

python_command = detect_python()

# call esptool.py to update firmware
def update_firmware(port):
    print("Updating firmware...")
    print("Port: " + port)
    print("Firmware: v2.0")
    # C:/Users/Cri User/AppData/Local/Arduino15/packages/esp32/tools/esptool_py/2.6.1/esptool.exe --chip esp32 --port COM1 --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 80m --flash_size detect
    # 0xe000 C:/Users/Cri User/AppData/Local/Arduino15/packages/esp32/hardware/esp32/1.0.4/tools/partitions/boot_app0.bin 
    # 0x1000 C:/Users/Cri User/AppData/Local/Arduino15/packages/esp32/hardware/esp32/1.0.4/tools/sdk/bin/bootloader_qio_80m.bin 
    # 0x10000 C:/Users/CRIUSE~1/AppData/Local/Temp/arduino_build_331166/main.ino.bin 
    # 0x8000 C:/Users/CRIUSE~1/AppData/Local/Temp/arduino_build_331166/main.ino.partitions.bin 


    subprocess.call([python_command, "esptool/esptool.py", "--port", port , "--chip" , "esp32", "--baud", "921600", "--before", "default_reset", "--after", "hard_reset", "write_flash", "-z", "--flash_mode", "dio", "--flash_freq", "80m", "--flash_size", "detect",
                     "0xe000", "binaries/bootapp.bin", 
                     "0x1000", "binaries/bootloader.bin", 
                     "0x10000", "binaries/main.ino.bin", 
                     "0x8000", "binaries/main.ino.partitions.bin",
                     "0x00290000", "binaries/main.spiffs.bin"])

def serial_ports():
    """ Lists serial port names using pyserial

        :raises EnvironmentError:
            On unsupported or unknown platforms
        :returns:
            A list of the serial ports available on the system
    """

    # use serial.tools.list_ports.comports()
    # if it fails, use the old method
    try:
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]
    except:
        pass



# if the first argument is "-d"
if len(sys.argv) > 1 and sys.argv[1] == "-d":
    print("debug mode")

else:

    # start the program, show list of ports and ask for which port to use
    print ("Open qByte Firmware Updater")
    print ("---------------------------")
    print ("")
    print ("Available ports:")
    print ("")
    ports = serial_ports()
    for port in ports:
        print (port)
    print ("")
    port = input("Enter port to use: ")
    update_firmware(port)
    time.sleep(3)
    print("Updated! Do you want to configure the wifi settings? (y/n)")
    answer = input()
    if answer == "y":
        credentials = input("Enter wifi credentials (ssid,password): ")
        print("Wifi credentials: " + credentials)
        print("Updating wifi credentials...")
        ssid, password = credentials.split(",")

        serial_command = "wifi \"" + ssid + "\" \"" + password + "\"\n"
        # send the command to the qByte two times
        ser = serial.Serial(port, 115200, timeout=1000)
        ser.write(serial_command.encode())
        # delay 2 seconds
        time.sleep(2)
        ser.write(serial_command.encode())
        time.sleep(2)
        ser.close()
        print("Done!")
