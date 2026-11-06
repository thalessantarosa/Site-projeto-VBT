// Reference firmware: ESP32 Arduino + NimBLE-Arduino 2.3.6 + Adafruit MPU6050.
// Verify board pins before wiring. This is streaming only, with no retransmission.
#include <Arduino.h>
#include <Wire.h>
#include <NimBLEDevice.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <atomic>
#include <cmath>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

constexpr int I2C_SDA = 4;  // Adapt to the exact board.
constexpr int I2C_SCL = 5;
constexpr uint32_t SAMPLE_INTERVAL_US = 10000;
constexpr uint32_t MAX_SERIES_US = 180000000; // Three minutes; avoids timestamp wrap.
constexpr uint16_t NO_CONNECTION = 0xffff;
constexpr char FIRMWARE_VERSION[] = "prototype-1";
constexpr char SERVICE_UUID[] = "824f0001-53cb-4a5b-9f4b-93e1a5e8f001";
constexpr char COMMAND_UUID[] = "824f0002-53cb-4a5b-9f4b-93e1a5e8f001";
constexpr char DATA_UUID[] = "824f0003-53cb-4a5b-9f4b-93e1a5e8f001";
constexpr char STATUS_UUID[] = "824f0004-53cb-4a5b-9f4b-93e1a5e8f001";

Adafruit_MPU6050 imu;
NimBLECharacteristic* dataCharacteristic;
NimBLECharacteristic* statusCharacteristic;
std::atomic<uint16_t> connection{NO_CONNECTION};
std::atomic<bool> linkReset{false};
std::atomic<bool> queueOverflow{false};
enum CommandCode : uint8_t { START, STOP, PING, UNKNOWN };
struct Command { CommandCode code; uint16_t handle; };
QueueHandle_t commands;
bool streaming = false;
uint32_t startedUs = 0, nextSampleUs = 0, notifyFailures = 0;
uint16_t sequence = 0;

// All sensor access and acquisition state changes happen in loop(), not BLE callbacks.
void setStatus(const char* text) {
  statusCharacteristic->setValue(text);
  if (connection.load() != NO_CONNECTION) statusCharacteristic->notify();
  Serial.printf("STATUS %s\n", text);
}

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& info) override {
    uint16_t expected = NO_CONNECTION;
    if (!connection.compare_exchange_strong(expected, info.getConnHandle())) {
      server->disconnect(info.getConnHandle());
      return;
    }
    // 7.5–15 ms connection interval request; the central may choose otherwise.
    server->updateConnParams(info.getConnHandle(), 6, 12, 0, 200);
  }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo& info, int) override {
    uint16_t expected = info.getConnHandle();
    if (connection.compare_exchange_strong(expected, NO_CONNECTION)) linkReset.store(true);
    NimBLEDevice::startAdvertising();
  }
} serverCallbacks;

class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& info) override {
    if (connection.load() != info.getConnHandle()) return;
    const std::string value = characteristic->getValue();
    const CommandCode code = value == "START" ? START : value == "STOP" ? STOP : value == "PING" ? PING : UNKNOWN;
    const Command command{code, info.getConnHandle()};
    if (xQueueSend(commands, &command, 0) != pdTRUE) queueOverflow.store(true);
  }
} commandCallbacks;

void write16(uint8_t* target, uint16_t value) {
  target[0] = value & 0xff; target[1] = value >> 8;
}
void write32(uint8_t* target, uint32_t value) {
  for (uint8_t i = 0; i < 4; i++) target[i] = (value >> (8 * i)) & 0xff;
}
int16_t quantize(float value, float scale) {
  const float scaled = value * scale;
  return static_cast<int16_t>(lroundf(fmaxf(-32768.f, fminf(32767.f, scaled))));
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("VBT firmware %s; SDA=%d SCL=%d\n", FIRMWARE_VERSION, I2C_SDA, I2C_SCL);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
  if (!imu.begin(0x68, &Wire) && !imu.begin(0x69, &Wire)) {
    Serial.println("MPU6050 not found. Verify power, I2C pins and address.");
    while (true) delay(1000);
  }
  imu.setAccelerometerRange(MPU6050_RANGE_8_G);
  imu.setGyroRange(MPU6050_RANGE_500_DEG);
  imu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  commands = xQueueCreate(4, sizeof(Command));
  if (!commands) { Serial.println("Cannot allocate command queue"); while (true) delay(1000); }
  NimBLEDevice::init("VBT-ESP32");
  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(&serverCallbacks);
  NimBLEService* service = server->createService(SERVICE_UUID);
  NimBLECharacteristic* command = service->createCharacteristic(COMMAND_UUID, NIMBLE_PROPERTY::WRITE);
  command->setCallbacks(&commandCallbacks);
  dataCharacteristic = service->createCharacteristic(DATA_UUID, NIMBLE_PROPERTY::NOTIFY);
  statusCharacteristic = service->createCharacteristic(STATUS_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  statusCharacteristic->setValue("READY");
  service->start();
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setName("VBT-ESP32");
  advertising->enableScanResponse(true);
  advertising->start();
  Serial.println("MPU6050 ready. Advertising as VBT-ESP32");
}

void loop() {
  if (linkReset.exchange(false)) { streaming = false; setStatus("READY"); }
  if (queueOverflow.exchange(false)) { streaming = false; setStatus("ERROR:COMMAND_QUEUE_FULL"); }
  Command command;
  while (xQueueReceive(commands, &command, 0) == pdTRUE) {
    if (connection.load() == NO_CONNECTION || command.handle != connection.load()) continue;
    switch (command.code) {
      case START:
        if (streaming) { setStatus("ERROR:ALREADY_RECORDING"); break; }
        sequence = 0; notifyFailures = 0;
        startedUs = micros(); nextSampleUs = startedUs;
        streaming = true; setStatus("STARTED");
        break;
      case STOP:
        streaming = false; setStatus("STOPPED");
        Serial.printf("Notification failures: %lu (not a receipt guarantee)\n", static_cast<unsigned long>(notifyFailures));
        break;
      case PING: setStatus(streaming ? "STARTED" : "READY"); break;
      default: setStatus("ERROR:UNKNOWN_COMMAND"); break;
    }
  }
  if (!streaming || connection.load() == NO_CONNECTION) { delay(1); return; }
  const uint32_t now = micros();
  if (static_cast<uint32_t>(now - startedUs) >= MAX_SERIES_US) {
    streaming = false; setStatus("ERROR:MAX_DURATION_180S"); return;
  }
  if (static_cast<int32_t>(now - nextSampleUs) < 0) { delay(1); return; }
  // Do not fabricate catch-up readings. Skipped nominal slots advance sequence.
  const uint32_t skipped = (now - nextSampleUs) / SAMPLE_INTERVAL_US;
  sequence = static_cast<uint16_t>(sequence + skipped);
  nextSampleUs += (skipped + 1) * SAMPLE_INTERVAL_US;
  sensors_event_t acceleration, gyro, temperature;
  if (!imu.getEvent(&acceleration, &gyro, &temperature)) {
    streaming = false; setStatus("ERROR:IMU_READ"); return;
  }
  const float values[] = { acceleration.acceleration.x, acceleration.acceleration.y, acceleration.acceleration.z,
                           gyro.gyro.x, gyro.gyro.y, gyro.gyro.z };
  uint8_t packet[19] = {1};
  write16(packet + 1, sequence++);
  write32(packet + 3, static_cast<uint32_t>(now - startedUs));
  for (uint8_t i = 0; i < 6; i++) {
    if (!std::isfinite(values[i])) { streaming = false; setStatus("ERROR:IMU_VALUE"); return; }
    write16(packet + 7 + 2 * i, static_cast<uint16_t>(quantize(values[i], i < 3 ? 256.f : 2048.f)));
  }
  dataCharacteristic->setValue(packet, sizeof(packet));
  if (!dataCharacteristic->notify()) notifyFailures++;
}
