import os
import sys
import subprocess
import glob
import shutil

def find_tool(tool_name_pattern, search_paths):
    for path in search_paths:
        expanded = glob.glob(os.path.expanduser(path))
        for p in expanded:
            for root, dirs, files in os.walk(p):
                for file in files:
                    if tool_name_pattern in file:
                        if os.access(os.path.join(root, file), os.X_OK) or tool_name_pattern.endswith(".py"):
                            return os.path.join(root, file)
    return None

def main():
    print("== ESP32 SPIFFS Auto-Upload Script ==")
    
    data_dir = "code/main/data"
    image_file = "spiffs.bin"
    spiffs_offset = "0x670000"
    spiffs_size = 0x180000 
    
    arduino_packages = "~/Library/Arduino15/packages/esp32/tools"
    
    mkspiffs = find_tool("mkspiffs", [arduino_packages + "/mkspiffs/*"])
    if not mkspiffs:
        print("Error: mkspiffs not found. Ensure ESP32 core is installed in Arduino IDE.")
        sys.exit(1)
        
    esptool = find_tool("esptool", [arduino_packages + "/esptool_py/*"])
    if not esptool:
        esptool = shutil.which("esptool")
        if not esptool:
            esptool = shutil.which("esptool.py")

    port = sys.argv[1] if len(sys.argv) > 1 else None
    if not port:
        ports = glob.glob("/dev/cu.usbserial-*") + glob.glob("/dev/cu.SLAB_USBtoUART") + glob.glob("/dev/cu.usbmodem*")
        if ports: port = ports[0]
        else:
            print("Usage: python3 upload_spiffs.py <port>")
            sys.exit(1)

    print(f"Packing SPIFFS...")
    cmd_mkspiffs = [mkspiffs, "-c", data_dir, "-b", "4096", "-p", "256", "-s", str(spiffs_size), image_file]
    if subprocess.run(cmd_mkspiffs).returncode != 0:
        print("Error creating SPIFFS image.")
        sys.exit(1)

    print(f"Uploading SPIFFS to {port} at {spiffs_offset}...")
    cmd_upload = [esptool, "--chip", "esp32s3", "--port", port, "--baud", "460800", "write_flash", spiffs_offset, image_file]
    if subprocess.run(cmd_upload).returncode == 0:
        print("SUCCESS! SPIFFS uploaded successfully.")
        os.remove(image_file)
    else:
        print("FAILURE! SPIFFS upload failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()