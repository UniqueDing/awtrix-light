#include "AppStore.h"

static const char appStoreManifestJson[] PROGMEM = R"EOF([{"id":"demo-clock","name":"Demo Clock","version":"1.0.0","author":"AWTRIX Local","description":"Local demo JSON app"}])EOF";

static const char demoClockAppJson[] PROGMEM = R"EOF({"text":"Demo Clock","duration":10,"save":true})EOF";

const char *getAppStoreManifestJson()
{
  return appStoreManifestJson;
}

const char *getAppStoreAppJson(const String &id)
{
  if (id == "demo-clock")
  {
    return demoClockAppJson;
  }

  return nullptr;
}
