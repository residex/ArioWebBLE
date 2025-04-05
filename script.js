// This code recreates the BLE communication functionality from Python to Web BLE
// You'll need protobufjs for handling the Protocol Buffer messages

// First, we need to load the protobuf definitions
// We're creating simplified versions of the Protocol Buffers here since we can't directly import them
const protobuf = window.protobuf; // Assumes protobuf.js is loaded via script tag

// Protocol Buffer definitions (simplified versions)
const bleParamsProto = `
syntax = "proto3";

message BLE_Params {
  uint32 key = 1;
  string value = 2;
}

message ble_msg {
  int64 TimeStamp = 1;
  uint32 Serial = 2;
  bool Online = 3;
  uint32 MsgNums = 4;
  repeated BLE_Params Params = 5;
}
`;

// Common codes (simplified based on the Python code)
const COMMON_CODE = {
  BLE_PUB_KEY: 2822, // Based on the login code from the Python script
  UNLOCK: 1728,
  LOCK: 1729,
};

// Constants for BLE communication
window.BIKE_IMEI = null; // Will be populated from API response
window.BIKE_DEVICE_IMEI = null;
window.BLE_DEVICE_IMEI = null;

const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const CHARACTERISTIC_UUID = "0000fff6-0000-1000-8000-00805f9b34fb";

let messageId = 1;
let loggedIn = false;
let bleDevice = null;
let gattServer = null;
let bleCharacteristic = null;
let protobufRoot = null;

// Utility to base64 encode a Uint8Array
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Initialize protobuf
async function initProtobuf() {
  try {
    protobufRoot = protobuf.parse(bleParamsProto).root;
    console.log("Protocol Buffers initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Protocol Buffers:", error);
  }
}

// Generate login payload (similar to the Python implementation)
function generateLoginPayload(deviceImei) {
  console.log(`Generating login payload for device IMEI: ${deviceImei}`);
  const imeiBytes = new TextEncoder().encode(deviceImei);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();

  const copyOf = new Uint8Array(imeiBytes.length + 1);
  copyOf.set(imeiBytes);
  copyOf[imeiBytes.length] = currentHour;

  const copyOf2 = new Uint8Array(copyOf.length + 1);
  copyOf2.set(copyOf);
  copyOf2[copyOf.length] = currentMinute;

  const copyOf3 = new Uint8Array(copyOf2.length + 1);
  copyOf3.set(copyOf2);
  copyOf3[copyOf2.length] = currentSecond;

  // Generate 5 random bytes
  const randomFiveBytes = new Uint8Array(5);
  crypto.getRandomValues(randomFiveBytes);

  const copyOf4 = new Uint8Array(copyOf3.length + randomFiveBytes.length);
  copyOf4.set(copyOf3);
  copyOf4.set(randomFiveBytes, copyOf3.length);

  const encryptionKey = new TextEncoder().encode("aK33M2g8");

  const copyOf5 = new Uint8Array(copyOf4.length + encryptionKey.length);
  copyOf5.set(copyOf4);
  copyOf5.set(encryptionKey, copyOf4.length);

  return arrayBufferToBase64(copyOf5);
}

// Create message payload (similar to send_message in Python)
function sendMessage(code, value) {
  const currentMessageId = messageId++;

  const BleMsg = protobufRoot.lookupType("ble_msg");

  const messageObj = {
    TimeStamp: Date.now(),
    Serial: currentMessageId,
    Online: true,
    MsgNums: 1,
    Params: [
      {
        key: code,
        value: value,
      },
    ],
  };

  const message = BleMsg.create(messageObj);
  return BleMsg.encode(message).finish();
}

// Handle notification data
function handleNotification(dataView) {
  try {
    const BleMsg = protobufRoot.lookupType("ble_msg");
    const message = BleMsg.decode(new Uint8Array(dataView.buffer));

    console.log("Received message:", message);

    // Handle params similar to Python code
    handleParams(message.Params);
  } catch (error) {
    console.error("Failed to decode protobuf:", error);
  }
}

// Handle params similar to the Python implementation
function handleParams(params) {
  for (const param of params) {
    if (
      param.key == COMMON_CODE.BLE_PUB_KEY &&
      param.value == "1" &&
      !loggedIn
    ) {
      console.log("Login successful.");
      loggedIn = true;
      document.getElementById("login-status").textContent = "Logged In";
      document.getElementById("command-form").style.display = "block";
      
      // Enable action buttons
      document.getElementById("unlock-button").disabled = false;
      document.getElementById("lock-button").disabled = false;
      document.getElementById("send-command-button").disabled = false;
      
      // Add success message to log
      addToResponseLog("Login successful", "success");
      return;
    }
  }

  if (loggedIn) {
    for (const param of params) {
      console.log(`Response to command ${param.key}: ${param.value}`);
      
      // Format the response based on command type
      let responseMessage = `Response to command ${param.key}: ${param.value}`;
      let responseType = "info";
      
      // Check if it's a response to specific commands
      if (param.key == COMMON_CODE.UNLOCK) {
        responseMessage = param.value === "1" ? "Unlock successful" : "Unlock failed";
        responseType = param.value === "1" ? "success" : "error";
      } else if (param.key == COMMON_CODE.LOCK) {
        responseMessage = param.value === "1" ? "Lock successful" : "Lock failed";
        responseType = param.value === "1" ? "success" : "error";
      }
      
      addToResponseLog(responseMessage, responseType);
    }
  }
}

// Add message to response log with formatting
function addToResponseLog(message, type = "info") {
  const responseLog = document.getElementById("response-log");
  
  // Clear "No responses yet" message if it's still there
  if (responseLog.innerHTML.includes("No responses yet")) {
    responseLog.innerHTML = "";
  }
  
  // Create styled message element
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  
  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timestampSpan = document.createElement("span");
  timestampSpan.textContent = `[${timestamp}] `;
  timestampSpan.style.color = "#777";
  messageElement.prepend(timestampSpan);
  
  // Style based on message type
  switch (type) {
    case "success":
      messageElement.style.color = "#4CAF50";
      break;
    case "error":
      messageElement.style.color = "#f44336";
      break;
    case "warning":
      messageElement.style.color = "#ff9800";
      break;
    default:
      messageElement.style.color = "#000";
  }
  
  // Add to log
  responseLog.appendChild(messageElement);
  
  // Scroll to bottom
  responseLog.scrollTop = responseLog.scrollHeight;
}

// Scan for BLE devices
async function scanForDevices() {
  // Check if we have a valid IMEI
  if (!window.BIKE_IMEI || !window.BLE_DEVICE_IMEI) {
    addToResponseLog("Please find a car first to get the IMEI", "error");
    document.getElementById("status").textContent = "Error: No car IMEI found";
    return false;
  }
  
  try {
    console.log("Requesting Bluetooth device...");
    document.getElementById("status").textContent =
      "Scanning for ARIO device...";
      
    // Use both possible name prefixes for the device
    const deviceNamePrefix1 = `ARIO_${window.BLE_DEVICE_IMEI}`;
    const deviceNamePrefix2 = `ARIO_${window.BIKE_IMEI}`;
    
    console.log(`Looking for device with name prefixes: ${deviceNamePrefix1} or ${deviceNamePrefix2}`);
    
    addToResponseLog(`Scanning for devices with names starting with either ${deviceNamePrefix1} or ${deviceNamePrefix2}`, "info");

    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: deviceNamePrefix1 },
        { namePrefix: deviceNamePrefix2 }
      ],
      optionalServices: [SERVICE_UUID],
    });

    if (!bleDevice) {
      console.log("No device selected");
      document.getElementById("status").textContent = "No device selected";
      return false;
    }

    console.log(`Found device: ${bleDevice.name}`);
    document.getElementById(
      "status"
    ).textContent = `Found device: ${bleDevice.name}`;

    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);
    return true;
  } catch (error) {
    console.error("Error scanning for devices:", error);
    document.getElementById("status").textContent = `Error: ${error.message}`;
    return false;
  }
}

// Handle disconnection
function onDisconnected() {
  console.log("Device disconnected");
  document.getElementById("status").textContent = "Device disconnected";
  document.getElementById("login-status").textContent = "Not Logged In";
  document.getElementById("command-form").style.display = "none";
  
  // Disable action buttons
  document.getElementById("unlock-button").disabled = true;
  document.getElementById("lock-button").disabled = true;
  document.getElementById("send-command-button").disabled = true;
  
  loggedIn = false;
  gattServer = null;
  bleCharacteristic = null;
  
  addToResponseLog("Device disconnected", "warning");
}

// Connect to the device and set up notifications
async function connectToDevice() {
  if (!bleDevice) {
    console.error("No device selected");
    return false;
  }

  try {
    document.getElementById("status").textContent = "Connecting...";
    gattServer = await bleDevice.gatt.connect();
    console.log("Connected to GATT server");

    const service = await gattServer.getPrimaryService(SERVICE_UUID);
    console.log("Found service:", SERVICE_UUID);

    bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    console.log("Found characteristic:", CHARACTERISTIC_UUID);

    // Start notifications
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener(
      "characteristicvaluechanged",
      (event) => {
        handleNotification(event.target.value);
      }
    );

    document.getElementById("status").textContent =
      "Connected and notifications started";
    
    addToResponseLog("Connected to device", "info");

    // Send login message
    await sendLoginMessage();
    return true;
  } catch (error) {
    console.error("Error connecting to device:", error);
    document.getElementById(
      "status"
    ).textContent = `Connection error: ${error.message}`;
    
    addToResponseLog(`Connection error: ${error.message}`, "error");
    return false;
  }
}

// Send login message
async function sendLoginMessage() {
  // Check if we have a valid IMEI
  if (!window.BIKE_IMEI || !window.BIKE_DEVICE_IMEI) {
    addToResponseLog("Please find a car first to get the IMEI", "error");
    document.getElementById("status").textContent = "Error: No car IMEI found";
    return false;
  }

  if (!bleCharacteristic) {
    console.error("No characteristic available");
    return false;
  }

  try {
    // Use current value from window.BIKE_DEVICE_IMEI
    const loginPayload = generateLoginPayload(window.BIKE_DEVICE_IMEI);
    console.log("Login payload:", loginPayload);

    const loginMessage = sendMessage(COMMON_CODE.BLE_PUB_KEY, loginPayload);
    console.log(
      "Login message (hex):",
      Array.from(loginMessage)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );

    await bleCharacteristic.writeValueWithoutResponse(loginMessage);
    console.log("Login message sent");
    document.getElementById("status").textContent =
      "Login message sent, waiting for response...";
    
    addToResponseLog("Authenticating with device...", "info");
  } catch (error) {
    console.error("Error sending login message:", error);
    document.getElementById(
      "status"
    ).textContent = `Login error: ${error.message}`;
    
    addToResponseLog(`Login error: ${error.message}`, "error");
  }
}

// Send unlock command
async function sendUnlockCommand() {
  // Check if we have a valid IMEI
  if (!window.BIKE_IMEI || !window.BIKE_DEVICE_IMEI) {
    addToResponseLog("Please find a car first to get the IMEI", "error");
    return;
  }
  
  if (!loggedIn) {
    addToResponseLog("Must be logged in to unlock", "error");
    return;
  }
  
  try {
    document.getElementById("status").textContent = "Sending unlock command...";
    addToResponseLog("Sending unlock command...", "info");
    await sendCommand(COMMON_CODE.UNLOCK, "0");
  } catch (error) {
    console.error("Error unlocking:", error);
    addToResponseLog(`Error unlocking: ${error.message}`, "error");
  }
}

// Send lock command
async function sendLockCommand() {
  // Check if we have a valid IMEI
  if (!window.BIKE_IMEI || !window.BIKE_DEVICE_IMEI) {
    addToResponseLog("Please find a car first to get the IMEI", "error");
    return;
  }
  
  if (!loggedIn) {
    addToResponseLog("Must be logged in to lock", "error");
    return;
  }
  
  try {
    document.getElementById("status").textContent = "Sending lock command...";
    addToResponseLog("Sending lock command...", "info");
    await sendCommand(COMMON_CODE.LOCK, "0");
  } catch (error) {
    console.error("Error locking:", error);
    addToResponseLog(`Error locking: ${error.message}`, "error");
  }
}

// Send a command
async function sendCommand(commandCode, commandValue) {
  // Check if we have a valid IMEI
  if (!window.BIKE_IMEI || !window.BIKE_DEVICE_IMEI) {
    addToResponseLog("Please find a car first to get the IMEI", "error");
    return;
  }
  
  if (!bleCharacteristic || !loggedIn) {
    console.error("Not ready to send commands");
    return;
  }

  try {
    const commandMessage = sendMessage(commandCode, commandValue);
    console.log(
      "Sending command message (hex):",
      Array.from(commandMessage)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );

    await bleCharacteristic.writeValueWithoutResponse(commandMessage);
    console.log("Command message sent");
    document.getElementById("status").textContent =
      "Command sent, waiting for response...";
  } catch (error) {
    console.error("Error sending command:", error);
    document.getElementById(
      "status"
    ).textContent = `Command error: ${error.message}`;
    
    addToResponseLog(`Command error: ${error.message}`, "error");
  }
}

// API endpoint for getting car info
const API_URL = "https://app.3km.tech/app/api/carinfo";

// Find car by ID
async function findCarById(carId) {
  try {
    document.getElementById("find-car-button").disabled = true;
    document.getElementById("find-car-button").textContent = "Searching...";
    
    addToResponseLog(`Searching for car ID: ${carId}...`, "info");
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Version': '101',
        'Locale': 'en_AU',
        'Os': '1',
        'Accept-Language': 'en-AU;q=1.0',
        'Token': '3e9787d5a40ea1c5c3c1d03677837510dc9d7e6d278e614fa85afb54aa642078',
        'Accept-Encoding': 'gzip, deflate, br',
        'Deviceid': 'C5898E431F44919F6FDF547EFBE8992D',
        'User-Agent': 'Ario/1.7.1 (sg.ario.scooter; build:101; iOS 18.3.1) Alamofire/5.9.0'
      },
      body: JSON.stringify({ car_id: carId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.res_code !== 0 || !data.data) {
      throw new Error("Failed to find car or invalid response format");
    }
    
    const carInfo = data.data;
    
    // Update global BIKE_IMEI constant with the found IMEI
    if (carInfo.imei) {
      window.BIKE_IMEI = carInfo.imei;
      window.BIKE_DEVICE_IMEI = carInfo.imei.substring(6, 14);
      window.BLE_DEVICE_IMEI = carInfo.imei.substring(2, 14);
      
      // Display car info
      document.getElementById("car-imei").textContent = carInfo.imei;
      document.getElementById("car-battery").textContent = carInfo.battery || "N/A";
      document.getElementById("car-location").textContent = 
        `${carInfo.latitude.toFixed(6)}, ${carInfo.longitude.toFixed(6)}`;
      
      // Show info box
      document.getElementById("car-info-status").style.display = "block";
      
      // Enable scan button now that we have the IMEI
      document.getElementById("scan-button").disabled = false;
      
      addToResponseLog(`Found car! IMEI: ${carInfo.imei}`, "success");
      
      // Update scan button text to include found car ID
      document.getElementById("scan-button").textContent = `Scan for ARIO Device (${window.BLE_DEVICE_IMEI} or ${window.BIKE_IMEI})`;
    } else {
      throw new Error("No IMEI found in response");
    }
    
    return carInfo;
  } catch (error) {
    console.error("Error finding car:", error);
    addToResponseLog(`Error finding car: ${error.message}`, "error");
    document.getElementById("car-info-status").style.display = "none";
    
    // Disable scan button since we don't have a valid IMEI
    document.getElementById("scan-button").disabled = true;
    document.getElementById("scan-button").textContent = "Scan for ARIO Device";
  } finally {
    document.getElementById("find-car-button").disabled = false;
    document.getElementById("find-car-button").textContent = "Find Car";
  }
}

// Initialize the application
async function initialize() {
  console.log("Initializing WebBLE Scooter Communication");
  await initProtobuf();
  
  // Find car button
  document.getElementById("find-car-button").addEventListener("click", async () => {
    const carId = document.getElementById("car-id").value.trim();
    if (!carId) {
      addToResponseLog("Please enter a Car ID", "error");
      return;
    }
    await findCarById(carId);
  });

  // Scan button
  document.getElementById("scan-button").addEventListener("click", async () => {
    const deviceFound = await scanForDevices();
    if (deviceFound) {
      document.getElementById("connect-button").disabled = false;
    }
  });
  
  // Connect button
  document.getElementById("connect-button").addEventListener("click", async () => {
    await connectToDevice();
  });
  
  // Command form
  document.getElementById("command-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const commandType = document.getElementById("command-type").value;
    const commandCode = parseInt(document.getElementById("command-code").value);
    let commandValue;

    if (commandType === "query") {
      commandValue = "#QRY_DEF#";
    } else {
      commandValue = document.getElementById("command-value").value;
    }

    sendCommand(commandCode, commandValue);
  });
  
  // Unlock button
  document.getElementById("unlock-button").addEventListener("click", async () => {
    await sendUnlockCommand();
  });
  
  // Lock button
  document.getElementById("lock-button").addEventListener("click", async () => {
    await sendLockCommand();
  });
}

// Check if Web Bluetooth is supported
if (!navigator.bluetooth) {
  console.error("Web Bluetooth is not supported in this browser");
  document.getElementById("status").textContent =
    "Web Bluetooth is not supported in this browser";
  
  // Show browser compatibility message
  addToResponseLog("Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or another compatible browser.", "error");
} else {
  window.addEventListener("load", initialize);
}