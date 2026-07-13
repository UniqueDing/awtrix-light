#include "effects.h"

#ifdef awtrix2_upgrade

Effect effects[1] = {{"", nullptr, EffectSettings()}};

void callEffect(FastLED_NeoMatrix *, int16_t, int16_t, u_int8_t) {}

int getEffectIndex(String) { return -1; }

void updateEffectSettings(u_int8_t, String) {}

void EffectOverlay(FastLED_NeoMatrix *, int16_t, int16_t, OverlayEffect) {}

OverlayEffect getOverlay(String) { return NONE; }
#endif
