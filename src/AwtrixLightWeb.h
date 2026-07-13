#pragma once

#include <Arduino.h>

class FSWebServer;

void setupAwtrixLightWebRoutes(FSWebServer &mws);
void setAwtrixLightRuntimeButton(byte btn, bool state);
void beginAwtrixLightRuntime();
void tickAwtrixLightRuntime();
