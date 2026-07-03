#pragma once

#include <Arduino.h>

const char *getAppStoreManifestJson();
const char *getAppStoreAppJson(const String &id);
