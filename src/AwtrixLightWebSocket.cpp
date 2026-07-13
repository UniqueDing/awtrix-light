#include "AwtrixLightWebSocket.h"

#ifdef awtrix2_upgrade
#include <WebSocketsServer.h>
#include <esp_system.h>
#include <string.h>

#include "AwtrixLightRuntime.h"

namespace
{
constexpr uint8_t kVersion = 1;
constexpr uint32_t kAuthTimeoutMs = 1000;
WebSocketsServer socketServer(81, "", "");
uint8_t token[16] = {};
bool tokenValid = false;
uint32_t tokenIssued = 0;
uint32_t generation = 0;
uint32_t clientGeneration = 0;
uint32_t connectedAt = 0;
uint32_t lastActivity = 0;
uint32_t lastPreview = 0;
uint32_t sentScreenSequence = 0;
bool screenSequenceSent = false;
uint8_t client = 0xFF;
uint8_t subscriptions = 0;
uint8_t previewFps = 30;
bool authenticated = false;
uint8_t screenPacket[774];

void resetClientState()
{
    clientGeneration = 0;
    connectedAt = 0;
    lastActivity = 0;
    lastPreview = 0;
    sentScreenSequence = 0;
    screenSequenceSent = false;
    subscriptions = 0;
    previewFps = 30;
    authenticated = false;
}

void put16(uint8_t *data, uint16_t value) { data[0] = value >> 8; data[1] = value; }
void put32(uint8_t *data, uint32_t value) { data[0] = value >> 24; data[1] = value >> 16; data[2] = value >> 8; data[3] = value; }

void sendError(uint8_t code, uint8_t related)
{
    uint8_t packet[] = {0x83, kVersion, code, related};
    socketServer.sendBIN(client, packet, sizeof(packet));
}

void sendAck(uint8_t type, uint16_t id, uint8_t status)
{
    uint8_t packet[] = {0x82, kVersion, type, uint8_t(id >> 8), uint8_t(id), status};
    socketServer.sendBIN(client, packet, sizeof(packet));
}

void sendSnapshot()
{
    uint8_t packet[7] = {0x86, kVersion};
    put32(packet + 2, AwtrixLightRuntime.buttonSequence());
    packet[6] = AwtrixLightRuntime.buttonBits();
    socketServer.sendBIN(client, packet, sizeof(packet));
}

bool validName(const uint8_t *data, size_t length)
{
    for (size_t i = 0; i < length; ++i)
        if (data[i] < 0x20 || data[i] > 0x7E)
            return false;
    return true;
}

void handlePacket(uint8_t *data, size_t length)
{
    if (length > 4096)
    {
        sendError(6, length ? data[0] : 0);
        socketServer.disconnect(client);
        return;
    }
    if (length < 2 || data[1] != kVersion)
    {
        sendError(length >= 2 ? 3 : 5, length ? data[0] : 0);
        if (length >= 2)
            socketServer.disconnect(client);
        return;
    }
    if (!authenticated)
    {
        bool valid = data[0] == 1 && length == 18 && tokenValid && uint32_t(millis() - tokenIssued) <= 15000 && memcmp(data + 2, token, 16) == 0;
        tokenValid = false;
        if (!valid)
        {
            sendError(data[0] == 1 ? 2 : 1, data[0]);
            socketServer.disconnect(client);
            return;
        }
        authenticated = true;
        lastActivity = millis();
        ++generation;
        clientGeneration = generation;
        uint8_t ready[10] = {0x81, kVersion};
        put32(ready + 2, generation);
        put16(ready + 6, 4096);
        ready[8] = 7;
        ready[9] = AwtrixLightRuntime.active() ? 2 : 0;
        socketServer.sendBIN(client, ready, sizeof(ready));
        return;
    }
    lastActivity = millis();
    uint16_t id = length >= 4 ? (uint16_t(data[2]) << 8) | data[3] : 0;
    switch (data[0])
    {
    case 2:
        if (length < 5 || data[4] > 32 || length != size_t(5 + data[4]) || !validName(data + 5, data[4]))
            sendAck(2, id, 4);
        else
            sendAck(2, id, AwtrixLightRuntime.claimWebSocket(clientGeneration) ? 0 : 2);
        break;
    case 3:
        if (length != 4)
            sendAck(3, id, 4);
        else
            sendAck(3, id, AwtrixLightRuntime.releaseWebSocket(clientGeneration) ? 0 : 3);
        break;
    case 4:
    {
        uint16_t sequence = id;
        uint8_t status = AwtrixLightRuntime.queueBinaryFrame(clientGeneration, data, length, sequence);
        sendAck(4, sequence, status);
        break;
    }
    case 5:
        if (length != 6 || (data[4] & 0xFC))
            sendAck(5, id, 4);
        else
        {
            subscriptions = data[4];
            previewFps = data[5] ? min(uint8_t(30), data[5]) : 30;
            screenSequenceSent = false;
            sendAck(5, id, 0);
            if (subscriptions & 2)
                sendSnapshot();
        }
        break;
    case 6:
        if (length == 6)
        {
            data[0] = 0x87;
            socketServer.sendBIN(client, data, length);
        }
        else
            sendError(5, 6);
        break;
    default:
        sendError(4, data[0]);
    }
}

void onSocketEvent(uint8_t number, WStype_t type, uint8_t *payload, size_t length)
{
    if (type == WStype_CONNECTED)
    {
        if (client != 0xFF)
        {
            if (authenticated)
            {
                uint8_t packet[] = {0x83, kVersion, 7, 0};
                socketServer.sendBIN(number, packet, sizeof(packet));
                socketServer.disconnect(number);
                return;
            }
            uint8_t staleClient = client;
            client = 0xFF;
            resetClientState();
            socketServer.disconnect(staleClient);
        }
        client = number;
        resetClientState();
        connectedAt = lastActivity = millis();
    }
    else if (type == WStype_DISCONNECTED && number == client)
    {
        if (authenticated)
            AwtrixLightRuntime.disconnectWebSocket(clientGeneration);
        client = 0xFF;
        resetClientState();
    }
    else if (type == WStype_BIN && number == client)
        handlePacket(payload, length);
    else if ((type == WStype_TEXT || type == WStype_FRAGMENT_BIN_START || type == WStype_FRAGMENT_TEXT_START) && number == client)
    {
        sendError(5, 0);
        socketServer.disconnect(client);
    }
}
}

void issueAwtrixLightRuntimeToken(char tokenHex[33])
{
    static const char digits[] = "0123456789abcdef";
    for (uint8_t i = 0; i < 16; i += 4)
    {
        uint32_t value = esp_random();
        memcpy(token + i, &value, 4);
    }
    for (uint8_t i = 0; i < 16; ++i)
    {
        tokenHex[i * 2] = digits[token[i] >> 4];
        tokenHex[i * 2 + 1] = digits[token[i] & 15];
    }
    tokenHex[32] = 0;
    tokenIssued = millis();
    tokenValid = true;
}

void beginAwtrixLightWebSocket()
{
    socketServer.begin();
    socketServer.onEvent(onSocketEvent);
}

void tickAwtrixLightWebSocket()
{
    socketServer.loop();
    if (client == 0xFF)
        return;
    uint32_t now = millis();
    if ((!authenticated && uint32_t(now - connectedAt) > kAuthTimeoutMs) || (authenticated && uint32_t(now - lastActivity) > 30000))
    {
        if (!authenticated)
            sendError(8, 0);
        socketServer.disconnect(client);
        return;
    }
    if (!authenticated)
        return;
    if (subscriptions & 2)
    {
        if (AwtrixLightRuntime.buttonOverflowed())
        {
            sendSnapshot();
            AwtrixLightRuntime.clearButtonOverflow();
        }
        uint32_t sequence;
        uint8_t button;
        bool pressed;
        while (AwtrixLightRuntime.popButtonEdge(sequence, button, pressed))
        {
            uint8_t packet[8] = {0x85, kVersion};
            put32(packet + 2, sequence);
            packet[6] = button;
            packet[7] = pressed ? 1 : 0;
            socketServer.sendBIN(client, packet, sizeof(packet));
        }
    }
    uint32_t screenSequence = AwtrixLightRuntime.screenSequence();
    if ((subscriptions & 1) && (!screenSequenceSent || screenSequence != sentScreenSequence) && uint32_t(now - lastPreview) >= 1000U / previewFps)
    {
        screenPacket[0] = 0x84;
        screenPacket[1] = kVersion;
        put32(screenPacket + 2, screenSequence);
        AwtrixLightRuntime.snapshotRgb(screenPacket + 6);
        if (socketServer.sendBIN(client, screenPacket, sizeof(screenPacket)))
        {
            sentScreenSequence = screenSequence;
            screenSequenceSent = true;
            lastPreview = now;
        }
    }
}
#else
void issueAwtrixLightRuntimeToken(char tokenHex[33]) { tokenHex[0] = 0; }
void beginAwtrixLightWebSocket() {}
void tickAwtrixLightWebSocket() {}
#endif
