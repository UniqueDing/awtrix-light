#include "AwtrixLightWeb.h"

#include <ArduinoJson.h>
#include <esp-fs-webserver.h>

#include "DisplayManager.h"
#include "Globals.h"
#include "AwtrixLightRuntime.h"
#include "AwtrixLightWebSocket.h"
#include "web_assets.h"

#ifndef awtrix2_upgrade
static bool runtimeButtonState[3] = {};

static uint32_t parseRuntimeColor(JsonVariant value, uint32_t fallback = 0xFFFFFF)
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
#endif

static void sendRuntimeOk(FSWebServer &mws, const String &extra = "")
{
    String body = "{\"ok\":true";
    body += extra;
    body += "}";
    mws.webserver->send(200, "application/json", body);
}

static void sendAppShell(FSWebServer &mws)
{
    mws.webserver->sendHeader("Content-Encoding", "gzip");
    mws.webserver->sendHeader("Cache-Control", "no-cache");
    mws.webserver->send_P(200, app_html_content_type, reinterpret_cast<const char *>(app_html_gz), app_html_gz_len);
}

void setAwtrixLightRuntimeButton(byte btn, bool state)
{
#ifdef awtrix2_upgrade
    AwtrixLightRuntime.setButton(btn, state);
#else
    if (btn < 3)
        runtimeButtonState[btn] = state;
#endif
}

void beginAwtrixLightRuntime()
{
#ifdef awtrix2_upgrade
    AwtrixLightRuntime.begin();
    beginAwtrixLightWebSocket();
#endif
}
void tickAwtrixLightRuntime()
{
#ifdef awtrix2_upgrade
    AwtrixLightRuntime.tick();
    tickAwtrixLightWebSocket();
#endif
}

void setupAwtrixLightWebRoutes(FSWebServer &mws)
{
#ifdef awtrix2_upgrade
    mws.addHandler("/api/runtime/session", HTTP_POST, [&mws]()
                   {
                     char token[33];
                      issueAwtrixLightRuntimeToken(token);
                      char body[112];
                      snprintf(body, sizeof(body), "{\"v\":1,\"port\":81,\"path\":\"/runtime\",\"token\":\"%s\",\"expiresMs\":15000}", token);
                      mws.webserver->sendHeader("Cache-Control", "no-store");
                      mws.webserver->send(200, "application/json", body); });
#endif
#ifdef awtrix2_upgrade
    mws.addHandler("/api/runtime/claim", HTTP_POST, [&mws]()
                   {
                     StaticJsonDocument<96> doc;
                     deserializeJson(doc, mws.webserver->arg("plain"));
                     char lease[33];
                     if (!AwtrixLightRuntime.claimHttp(lease)) {
                       mws.webserver->send(409, "application/json", "{\"ok\":false,\"error\":\"runtime_busy\"}");
                       return;
                     }
                     mws.webserver->send(200, "application/json", String("{\"ok\":true,\"lease\":\"") + lease + "\",\"expiresMs\":30000}"); });
    mws.addHandler("/api/runtime/release", HTTP_POST, [&mws]()
                   {
                     StaticJsonDocument<96> doc;
                     deserializeJson(doc, mws.webserver->arg("plain"));
                     if (!AwtrixLightRuntime.releaseHttp(doc["lease"] | "")) { mws.webserver->send(403, "application/json", "{\"ok\":false,\"error\":\"invalid_lease\"}"); return; }
                     sendRuntimeOk(mws); });
#else
    mws.addHandler("/api/runtime/claim", HTTP_POST, [&mws]() { sendRuntimeOk(mws); });
    mws.addHandler("/api/runtime/release", HTTP_POST, [&mws]() { sendRuntimeOk(mws); });
    mws.addHandler("/api/runtime/buttons", HTTP_GET, [&mws]()
                   { mws.webserver->send(200, "application/json", String("{\"left\":") + (runtimeButtonState[0] ? "true" : "false") + ",\"middle\":" + (runtimeButtonState[1] ? "true" : "false") + ",\"right\":" + (runtimeButtonState[2] ? "true" : "false") + "}"); });
    mws.addHandler("/api/runtime/frame", HTTP_POST, [&mws]()
                   {
                     DynamicJsonDocument doc(4096);
                     if (deserializeJson(doc, mws.webserver->arg("plain"))) { mws.webserver->send(400, "application/json", "{\"ok\":false}"); return; }
                     if (doc["clear"].as<bool>()) DisplayManager.clearMatrix();
                     for (JsonVariant command : doc["commands"].as<JsonArray>()) {
                       if (command["df"].is<JsonArray>()) { JsonArray a = command["df"]; DisplayManager.drawFilledRect(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, parseRuntimeColor(a[4])); }
                       else if (command["dt"].is<JsonArray>()) { JsonArray a = command["dt"]; DisplayManager.setCursor(a[0] | 0, (a[1] | 0) + 5); DisplayManager.setTextColor(parseRuntimeColor(a[3])); DisplayManager.matrixPrint(a[2].as<const char *>()); }
                       else if (command["dp"].is<JsonArray>()) { JsonArray a = command["dp"]; DisplayManager.drawPixel(a[0] | 0, a[1] | 0, parseRuntimeColor(a[2])); }
                       else if (command["dl"].is<JsonArray>()) { JsonArray a = command["dl"]; DisplayManager.drawLine(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, parseRuntimeColor(a[4])); }
                     }
                     DisplayManager.show();
                     sendRuntimeOk(mws); });
#endif
#ifdef awtrix2_upgrade
    mws.addHandler("/api/runtime/buttons", HTTP_GET, [&mws]()
                   {
                     uint8_t buttons = AwtrixLightRuntime.buttonBits();
                     String body = "{\"seq\":" + String(AwtrixLightRuntime.buttonSequence()) + ",\"left\":" + String(buttons & 1 ? "true" : "false") + ",\"middle\":" + String(buttons & 2 ? "true" : "false") + ",\"right\":" + String(buttons & 4 ? "true" : "false") + "}";
                     mws.webserver->send(200, "application/json", body); });
    mws.addHandler("/api/runtime/frame", HTTP_POST, [&mws]()
                   {
                     if (!AwtrixLightRuntime.frameHttp(mws.webserver->arg("plain").c_str())) { mws.webserver->send(403, "application/json", "{\"ok\":false,\"error\":\"invalid_lease_or_frame\"}"); return; }
                     sendRuntimeOk(mws); });
#endif

    mws.webserver->on("/api/auth/status", HTTP_GET, [&mws]()
                      { mws.webserver->send(200, "application/json", "{\"enabled\":" + String(AUTH_USER.length() > 0 ? "true" : "false") + "}"); });
    mws.webserver->on("/api/auth/check", HTTP_GET, [&mws]()
                      { mws.webserver->send(200, "application/json", "{\"ok\":true}"); });
    mws.webserver->on("/app-store", HTTP_GET, [&mws]()
                      { sendAppShell(mws); });
    mws.webserver->on("/my-apps", HTTP_GET, [&mws]()
                      { sendAppShell(mws); });
    mws.webserver->on("/settings", HTTP_GET, [&mws]()
                      { sendAppShell(mws); });
    mws.webserver->on("/files", HTTP_GET, [&mws]()
                      { sendAppShell(mws); });
    mws.webserver->on("/wifi", HTTP_GET, [&mws]()
                       { sendAppShell(mws); });
    mws.webserver->on("/", HTTP_GET, [&mws]()
                      {
                          mws.webserver->sendHeader("Location", "/my-apps", true);
                          mws.webserver->send(302, "text/plain", "");
                      });
}
