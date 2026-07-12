#include "AwtrixLightWeb.h"

#include <ArduinoJson.h>
#include <esp-fs-webserver.h>

#include "DisplayManager.h"
#include "Globals.h"
#include "web_assets.h"

static String runtimeOwner = "";
static bool runtimeButtonState[3] = {false, false, false};

static uint32_t parseRuntimeColor(JsonVariant value, uint32_t fallback = 0xFFFFFF)
{
    if (value.is<uint32_t>())
        return value.as<uint32_t>();
    if (value.is<const char *>())
    {
        String text = value.as<String>();
        text.trim();
        if (text.startsWith("#"))
            text.remove(0, 1);
        if (text.length() == 6)
            return strtoul(text.c_str(), nullptr, 16);
    }
    return fallback;
}

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
    if (btn < 3)
        runtimeButtonState[btn] = state;
}

void setupAwtrixLightWebRoutes(FSWebServer &mws)
{
    mws.addHandler("/api/runtime/claim", HTTP_POST, [&mws]()
                   {
                     DynamicJsonDocument doc(256);
                     deserializeJson(doc, mws.webserver->arg("plain"));
                     runtimeOwner = doc["owner"].as<String>();
                     sendRuntimeOk(mws, runtimeOwner.length() ? ",\"owner\":\"" + runtimeOwner + "\"" : ""); });
    mws.addHandler("/api/runtime/release", HTTP_POST, [&mws]()
                   { runtimeOwner = ""; sendRuntimeOk(mws); });
    mws.addHandler("/api/runtime/buttons", HTTP_GET, [&mws]()
                   {
                     String body = "{\"left\":" + String(runtimeButtonState[0] ? "true" : "false") + ",\"middle\":" + String(runtimeButtonState[1] ? "true" : "false") + ",\"right\":" + String(runtimeButtonState[2] ? "true" : "false") + "}";
                     mws.webserver->send(200, "application/json", body); });
    mws.addHandler("/api/runtime/frame", HTTP_POST, [&mws]()
                   {
                     DynamicJsonDocument doc(4096);
                     DeserializationError error = deserializeJson(doc, mws.webserver->arg("plain"));
                     if (error)
                     {
                         mws.webserver->send(400, "application/json", "{\"ok\":false,\"error\":\"invalid json\"}");
                         return;
                     }
                     if (doc["clear"].as<bool>())
                         DisplayManager.clearMatrix();
                     JsonArray commands = doc["commands"].as<JsonArray>();
                     for (JsonVariant command : commands)
                     {
                         if (command["df"].is<JsonArray>())
                         {
                             JsonArray a = command["df"].as<JsonArray>();
                             DisplayManager.drawFilledRect(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, parseRuntimeColor(a[4], 0xFFFFFF));
                         }
                         else if (command["dt"].is<JsonArray>())
                         {
                             JsonArray a = command["dt"].as<JsonArray>();
                             DisplayManager.setCursor(a[0] | 0, (a[1] | 0) + 5);
                             DisplayManager.setTextColor(parseRuntimeColor(a[3], 0xFFFFFF));
                             DisplayManager.matrixPrint(a[2].as<const char *>());
                         }
                         else if (command["dp"].is<JsonArray>())
                         {
                             JsonArray a = command["dp"].as<JsonArray>();
                             DisplayManager.drawPixel(a[0] | 0, a[1] | 0, parseRuntimeColor(a[2], 0xFFFFFF));
                         }
                         else if (command["dl"].is<JsonArray>())
                         {
                             JsonArray a = command["dl"].as<JsonArray>();
                             DisplayManager.drawLine(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, parseRuntimeColor(a[4], 0xFFFFFF));
                         }
                     }
                     DisplayManager.show();
                     sendRuntimeOk(mws); });

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
