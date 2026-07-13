#include "AwtrixLightRuntime.h"

#ifdef awtrix2_upgrade
#include <ArduinoJson.h>
#include <esp_system.h>
#include <string.h>

#include "DisplayManager.h"

namespace
{
constexpr size_t kMaxFrame = 4096;
constexpr uint32_t kHttpTimeoutMs = 30000;

enum Transport : uint8_t { NONE, HTTP, WEBSOCKET };

struct State
{
    Transport transport = NONE;
    uint32_t generation = 0;
    uint32_t activity = 0;
    uint8_t lease[16] = {};
    uint8_t frame[kMaxFrame] = {};
    bool pending = false;
    bool buttons[3] = {};
    uint32_t buttonSeq = 0;
    struct ButtonEdge { uint32_t sequence; uint8_t button; bool pressed; } buttonEdges[16] = {};
    uint8_t buttonHead = 0;
    uint8_t buttonCount = 0;
    bool buttonOverflow = false;
};

State state;

void randomBytes(uint8_t *data, size_t length)
{
    for (size_t offset = 0; offset < length; offset += 4)
    {
        uint32_t value = esp_random();
        size_t count = min(length - offset, sizeof(value));
        memcpy(data + offset, &value, count);
    }
}

void bytesToHex(const uint8_t *data, size_t length, char *hex)
{
    static const char digits[] = "0123456789abcdef";
    for (size_t i = 0; i < length; ++i)
    {
        hex[i * 2] = digits[data[i] >> 4];
        hex[i * 2 + 1] = digits[data[i] & 15];
    }
    hex[length * 2] = 0;
}

bool hexMatches(const char *hex, const uint8_t *data)
{
    if (!hex || strlen(hex) != 32)
        return false;
    char expected[33];
    bytesToHex(data, 16, expected);
    return memcmp(hex, expected, 32) == 0;
}

void clearOwner()
{
    state.transport = NONE;
    state.generation = 0;
    state.pending = false;
    state.buttonHead = 0;
    state.buttonCount = 0;
    state.buttonOverflow = false;
    DisplayManager.releaseRuntime();
}

void beginOwner(Transport transport)
{
    state.transport = transport;
    state.activity = millis();
    state.buttonHead = 0;
    state.buttonCount = 0;
    state.buttonOverflow = false;
    DisplayManager.claimRuntime();
}

bool validateUtf8(const uint8_t *text, size_t length)
{
    for (size_t i = 0; i < length;)
    {
        uint8_t c = text[i++];
        if (!c)
            return false;
        if (c < 0x80)
            continue;
        uint8_t remaining = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : c >= 0xC2 ? 1 : 0xFF;
        if (remaining == 0xFF || i + remaining > length)
            return false;
        while (remaining--)
            if ((text[i++] & 0xC0) != 0x80)
                return false;
    }
    return true;
}

bool validateFrame(const uint8_t *data, size_t length)
{
    if (length < 6 || length > kMaxFrame || data[0] != 0x04 || data[1] != 1 || (data[4] & 0xFE) || data[5] > 128)
        return false;
    size_t offset = 6;
    for (uint8_t command = 0; command < data[5]; ++command)
    {
        if (offset >= length)
            return false;
        uint8_t opcode = data[offset];
        size_t size = opcode == 1 || opcode == 4 ? 8 : opcode == 3 ? 6 : 0;
        if (opcode == 2)
        {
            if (offset + 7 > length)
                return false;
            size = 7 + data[offset + 6];
            if (offset + size > length || !validateUtf8(data + offset + 7, data[offset + 6]))
                return false;
        }
        else if (!size || offset + size > length)
            return false;
        if (opcode == 1 && (!data[offset + 3] || !data[offset + 4]))
            return false;
        offset += size;
    }
    return offset == length;
}

uint32_t color(const uint8_t *data)
{
    return (uint32_t(data[0]) << 16) | (uint32_t(data[1]) << 8) | data[2];
}

void applyBinaryFrame()
{
    const uint8_t *data = state.frame;
    if (data[4] & 1)
        DisplayManager.clearMatrix();
    size_t offset = 6;
    char text[129];
    for (uint8_t command = 0; command < data[5]; ++command)
    {
        const uint8_t *item = data + offset;
        switch (item[0])
        {
        case 1:
            DisplayManager.drawFilledRect(int8_t(item[1]), int8_t(item[2]), item[3], item[4], color(item + 5));
            offset += 8;
            break;
        case 2:
            memcpy(text, item + 7, item[6]);
            text[item[6]] = 0;
            DisplayManager.setCursor(int8_t(item[1]), int8_t(item[2]) + 5);
            DisplayManager.setTextColor(color(item + 3));
            DisplayManager.matrixPrint(text);
            offset += 7 + item[6];
            break;
        case 3:
            DisplayManager.drawPixel(int8_t(item[1]), int8_t(item[2]), color(item + 3));
            offset += 6;
            break;
        case 4:
            DisplayManager.drawLine(int8_t(item[1]), int8_t(item[2]), int8_t(item[3]), int8_t(item[4]), color(item + 5));
            offset += 8;
            break;
        }
    }
    DisplayManager.showRuntime();
}

uint32_t jsonColor(JsonVariant value, uint32_t fallback = 0xFFFFFF)
{
    if (value.is<uint32_t>())
        return value.as<uint32_t>();
    const char *text = value.as<const char *>();
    if (!text)
        return fallback;
    if (*text == '#')
        ++text;
    return strlen(text) == 6 ? strtoul(text, nullptr, 16) : fallback;
}
}

AwtrixLightRuntime_ &AwtrixLightRuntime_::getInstance()
{
    static AwtrixLightRuntime_ instance;
    return instance;
}

AwtrixLightRuntime_ &AwtrixLightRuntime = AwtrixLightRuntime_::getInstance();

void AwtrixLightRuntime_::begin() {}

void AwtrixLightRuntime_::tick()
{
    if (state.transport == HTTP && uint32_t(millis() - state.activity) > kHttpTimeoutMs)
        clearOwner();
    if (state.pending)
    {
        state.pending = false;
        applyBinaryFrame();
    }
}

bool AwtrixLightRuntime_::claimHttp(char leaseHex[33])
{
    if (state.transport != NONE)
        return false;
    randomBytes(state.lease, 16);
    bytesToHex(state.lease, 16, leaseHex);
    beginOwner(HTTP);
    return true;
}

bool validJsonCommand(JsonVariant command)
{
    if (!command.is<JsonObject>())
        return false;
    if (command["df"].is<JsonArray>())
        return command["df"].as<JsonArray>().size() >= 5;
    if (command["dt"].is<JsonArray>())
    {
        JsonArray values = command["dt"].as<JsonArray>();
        return values.size() >= 4 && values[2].is<const char *>();
    }
    if (command["dp"].is<JsonArray>())
        return command["dp"].as<JsonArray>().size() >= 3;
    if (command["dl"].is<JsonArray>())
        return command["dl"].as<JsonArray>().size() >= 5;
    return false;
}

bool AwtrixLightRuntime_::frameHttp(const char *json)
{
    DynamicJsonDocument doc(4096);
    if (deserializeJson(doc, json))
        return false;
    if (state.transport != HTTP || !hexMatches(doc["lease"] | "", state.lease))
        return false;
    if (!doc["commands"].is<JsonArray>())
        return false;
    for (JsonVariant command : doc["commands"].as<JsonArray>())
        if (!validJsonCommand(command))
            return false;
    if (doc["clear"].as<bool>())
        DisplayManager.clearMatrix();
    for (JsonVariant command : doc["commands"].as<JsonArray>())
    {
        if (command["df"].is<JsonArray>())
        {
            JsonArray a = command["df"];
            DisplayManager.drawFilledRect(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, jsonColor(a[4]));
        }
        else if (command["dt"].is<JsonArray>())
        {
            JsonArray a = command["dt"];
            DisplayManager.setCursor(a[0] | 0, (a[1] | 0) + 5);
            DisplayManager.setTextColor(jsonColor(a[3]));
            DisplayManager.matrixPrint(a[2].as<const char *>());
        }
        else if (command["dp"].is<JsonArray>())
        {
            JsonArray a = command["dp"];
            DisplayManager.drawPixel(a[0] | 0, a[1] | 0, jsonColor(a[2]));
        }
        else if (command["dl"].is<JsonArray>())
        {
            JsonArray a = command["dl"];
            DisplayManager.drawLine(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, jsonColor(a[4]));
        }
    }
    DisplayManager.showRuntime();
    state.activity = millis();
    return true;
}

bool AwtrixLightRuntime_::releaseHttp(const char *leaseHex)
{
    if (state.transport != HTTP || !hexMatches(leaseHex, state.lease))
        return false;
    clearOwner();
    return true;
}

void AwtrixLightRuntime_::setButton(byte button, bool pressed)
{
    if (button < 3 && state.buttons[button] != pressed)
    {
        state.buttons[button] = pressed;
        ++state.buttonSeq;
        if (state.buttonCount == 16)
        {
            state.buttonHead = 0;
            state.buttonCount = 0;
            state.buttonOverflow = true;
            return;
        }
        uint8_t index = (state.buttonHead + state.buttonCount) & 15;
        state.buttonEdges[index] = {state.buttonSeq, button, pressed};
        ++state.buttonCount;
    }
}

bool AwtrixLightRuntime_::active() const { return state.transport != NONE; }

bool AwtrixLightRuntime_::claimWebSocket(uint32_t generation)
{
    if (state.transport != NONE)
        return false;
    beginOwner(WEBSOCKET);
    state.generation = generation;
    return true;
}

bool AwtrixLightRuntime_::releaseWebSocket(uint32_t generation)
{
    if (state.transport != WEBSOCKET || state.generation != generation)
        return false;
    clearOwner();
    return true;
}

void AwtrixLightRuntime_::disconnectWebSocket(uint32_t generation)
{
    if (state.transport == WEBSOCKET && state.generation == generation)
        clearOwner();
}

uint8_t AwtrixLightRuntime_::queueBinaryFrame(uint32_t generation, const uint8_t *data, size_t length, uint16_t &sequence)
{
    if (!validateFrame(data, length))
        return length > kMaxFrame ? 5 : 4;
    sequence = (uint16_t(data[2]) << 8) | data[3];
    if (state.transport != WEBSOCKET || state.generation != generation)
        return 3;
    uint8_t status = state.pending ? 1 : 0;
    memcpy(state.frame, data, length);
    state.pending = true;
    state.activity = millis();
    return status;
}

void AwtrixLightRuntime_::snapshotRgb(uint8_t *rgb) const { DisplayManager.runtimeRgb(rgb); }
uint32_t AwtrixLightRuntime_::screenSequence() const { return DisplayManager.runtimeSequence(); }
uint32_t AwtrixLightRuntime_::buttonSequence() const { return state.buttonSeq; }
uint8_t AwtrixLightRuntime_::buttonBits() const { return (state.buttons[0] ? 1 : 0) | (state.buttons[1] ? 2 : 0) | (state.buttons[2] ? 4 : 0); }
bool AwtrixLightRuntime_::popButtonEdge(uint32_t &sequence, uint8_t &button, bool &pressed)
{
    if (!state.buttonCount)
        return false;
    const State::ButtonEdge &edge = state.buttonEdges[state.buttonHead];
    sequence = edge.sequence;
    button = edge.button;
    pressed = edge.pressed;
    state.buttonHead = (state.buttonHead + 1) & 15;
    --state.buttonCount;
    return true;
}
bool AwtrixLightRuntime_::buttonOverflowed() const { return state.buttonOverflow; }
void AwtrixLightRuntime_::clearButtonOverflow() { state.buttonOverflow = false; }
#else
AwtrixLightRuntime_ &AwtrixLightRuntime_::getInstance() { static AwtrixLightRuntime_ instance; return instance; }
AwtrixLightRuntime_ &AwtrixLightRuntime = AwtrixLightRuntime_::getInstance();
void AwtrixLightRuntime_::begin() {}
void AwtrixLightRuntime_::tick() {}
#endif
