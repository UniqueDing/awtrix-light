#pragma once

#include <Arduino.h>

class AwtrixLightRuntime_
{
public:
    static AwtrixLightRuntime_ &getInstance();
    void begin();
    void tick();
    bool claimHttp(char leaseHex[33]);
    bool frameHttp(const char *json);
    bool releaseHttp(const char *leaseHex);
    void setButton(byte button, bool state);
    bool active() const;
    bool claimWebSocket(uint32_t generation);
    bool releaseWebSocket(uint32_t generation);
    void disconnectWebSocket(uint32_t generation);
    uint8_t queueBinaryFrame(uint32_t generation, const uint8_t *data, size_t length, uint16_t &sequence);
    void snapshotRgb(uint8_t *rgb) const;
    uint32_t screenSequence() const;
    uint32_t buttonSequence() const;
    uint8_t buttonBits() const;
    bool popButtonEdge(uint32_t &sequence, uint8_t &button, bool &pressed);
    bool buttonOverflowed() const;
    void clearButtonOverflow();

private:
    AwtrixLightRuntime_() = default;
};

extern AwtrixLightRuntime_ &AwtrixLightRuntime;
