#include "ServerManager.h"
#include "Globals.h"
#include <WebServer.h>
#include <esp-fs-webserver.h>
#include <Update.h>
#include <LittleFS.h>
#include <WiFi.h>
#include "DisplayManager.h"
#include "AwtrixLightWeb.h"
#include "AppStore.h"
#include "UpdateManager.h"
#include "PeripheryManager.h"
#include "PowerManager.h"
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#ifndef awtrix2_upgrade
#include "Games/GameManager.h"
#include <EEPROM.h>
#endif

WiFiUDP udp;

unsigned int localUdpPort = 4210;
char incomingPacket[255];

// Pufferdefinition
#define BUFFER_SIZE 64
#ifndef awtrix2_upgrade
char dataBuffer[BUFFER_SIZE];
int bufferIndex = 0;
#endif

// Aktueller verbundener Client
WiFiClient currentClient = WiFiClient();
WebServer server(80);
FSWebServer mws(LittleFS, server);

// Erstelle eine Server-Instanz
WiFiServer TCPserver(8080);

// The getter for the instantiated singleton instance
ServerManager_ &ServerManager_::getInstance()
{
    static ServerManager_ instance;
    return instance;
}

// Initialize the global shared instance
ServerManager_ &ServerManager = ServerManager.getInstance();

void versionHandler()
{
    WebServerClass *webRequest = mws.getRequest();
    webRequest->send(200, F("text/plain"), VERSION);
}

static bool validCustomAppName(const String &name)
{
    if (name.length() == 0 || name.length() > 64 || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name.indexOf("..") >= 0)
        return false;
    for (size_t i = 0; i < name.length(); i++)
    {
        char c = name[i];
        bool valid = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.';
        if (!valid)
            return false;
    }
    return true;
}

#if defined(ULANZI) && defined(awtrix2_upgrade)
#error "Exactly one OTA target must be selected"
#elif defined(ULANZI)
static const char *const manualFirmwareTarget = "ulanzi";
#elif defined(awtrix2_upgrade)
static const char *const manualFirmwareTarget = "awtrix2-upgrade";
#else
#error "Unsupported OTA target"
#endif

static const uint32_t manualFirmwareImageLimit = 1310720;

struct ManualFirmwareUpload
{
    uint32_t bytes = 0;
    uint8_t files = 0;
    bool updateStarted = false;
    bool failed = false;
    bool fileComplete = false;
};

static ManualFirmwareUpload manualFirmwareUpload;

static bool validManualFirmwareVersion(const String &version)
{
    size_t offset = 0;
    for (uint8_t part = 0; part < 3; part++)
    {
        size_t start = offset;
        while (offset < version.length() && version[offset] >= '0' && version[offset] <= '9')
            offset++;
        if (offset == start)
            return false;
        if (part < 2 && (offset >= version.length() || version[offset++] != '.'))
            return false;
    }
    return version.substring(offset) == "-light";
}

static bool validManualFirmwareFilename(const String &filename)
{
    const String prefix = "awtrix-light-";
    const String suffix = String("-") + manualFirmwareTarget + ".bin";
    if (!filename.startsWith(prefix) || !filename.endsWith(suffix))
        return false;
    return validManualFirmwareVersion(filename.substring(prefix.length(), filename.length() - suffix.length()));
}

static void failManualFirmwareUpload()
{
    manualFirmwareUpload.failed = true;
    if (manualFirmwareUpload.updateStarted)
    {
        Update.abort();
        manualFirmwareUpload.updateStarted = false;
    }
}

static void handleManualFirmwareUpload()
{
    HTTPUpload &upload = mws.webserver->upload();
    if (upload.status == UPLOAD_FILE_START)
    {
        manualFirmwareUpload.files++;
        if (manualFirmwareUpload.files != 1 || upload.name != "firmware" || !validManualFirmwareFilename(upload.filename))
        {
            failManualFirmwareUpload();
            return;
        }
        if (!Update.begin(manualFirmwareImageLimit, U_FLASH))
        {
            failManualFirmwareUpload();
            return;
        }
        manualFirmwareUpload.updateStarted = true;
        return;
    }

    if (upload.status == UPLOAD_FILE_WRITE)
    {
        if (manualFirmwareUpload.failed || !manualFirmwareUpload.updateStarted || Update.hasError() || upload.currentSize > manualFirmwareImageLimit - manualFirmwareUpload.bytes ||
            Update.write(upload.buf, upload.currentSize) != upload.currentSize)
            failManualFirmwareUpload();
        else
            manualFirmwareUpload.bytes += upload.currentSize;
        return;
    }

    if (upload.status == UPLOAD_FILE_END)
    {
        if (manualFirmwareUpload.failed || !manualFirmwareUpload.updateStarted || Update.hasError() || manualFirmwareUpload.bytes == 0)
            failManualFirmwareUpload();
        else
            manualFirmwareUpload.fileComplete = true;
        return;
    }

    if (upload.status == UPLOAD_FILE_ABORTED)
        failManualFirmwareUpload();
}

static void finishManualFirmwareUpload()
{
    if (manualFirmwareUpload.files != 1 || !manualFirmwareUpload.fileComplete || manualFirmwareUpload.failed || !manualFirmwareUpload.updateStarted || Update.hasError() ||
        !Update.end(true))
    {
        failManualFirmwareUpload();
        mws.webserver->send(400, F("application/json"), F("{\"ok\":false,\"error\":\"firmware upload failed\"}"));
        manualFirmwareUpload = ManualFirmwareUpload();
        return;
    }

    manualFirmwareUpload.updateStarted = false;
    mws.webserver->client().setNoDelay(true);
    mws.webserver->send(202, F("application/json"), F("{\"ok\":true,\"status\":\"accepted\"}"));
    manualFirmwareUpload = ManualFirmwareUpload();
    delay(200);
    ESP.restart();
}

static void refreshCustomApp()
{
    String name = mws.webserver->arg("name");
    if (!validCustomAppName(name))
    {
        mws.webserver->send(400, F("application/json"), F("{\"success\":false,\"error\":\"invalid name\"}"));
        return;
    }

    String fileName = "/CUSTOMAPPS/" + name + ".json";
    if (!LittleFS.exists(fileName))
    {
        mws.webserver->send(404, F("application/json"), F("{\"success\":false,\"error\":\"app not found\"}"));
        return;
    }

    DisplayManager.refreshFlowApp(name);
    mws.webserver->send(200, F("application/json"), F("{\"success\":true}"));
}

static void uninstallCustomApp()
{
    DynamicJsonDocument doc(256);
    if (deserializeJson(doc, mws.webserver->arg("plain")) != DeserializationError::Ok)
    {
        mws.webserver->send(400, F("application/json"), F("{\"success\":false,\"error\":\"invalid json\"}"));
        return;
    }

    String name = doc["name"].as<String>();
    if (!validCustomAppName(name))
    {
        mws.webserver->send(400, F("application/json"), F("{\"success\":false,\"error\":\"invalid name\"}"));
        return;
    }

    String fileName = "/CUSTOMAPPS/" + name + ".json";
    if (!LittleFS.exists(fileName))
    {
        mws.webserver->send(404, F("application/json"), F("{\"success\":false,\"error\":\"app not found\"}"));
        return;
    }

    if (!DisplayManager.uninstallCustomApp(name))
    {
        mws.webserver->send(500, F("application/json"), F("{\"success\":false,\"error\":\"uninstall failed\"}"));
        return;
    }

    mws.webserver->send(200, F("application/json"), F("{\"success\":true}"));
}

static void sendIntegrationResult(int status, const char *body)
{
    mws.webserver->send(status, "application/json", body);
}

static bool integrationString(JsonDocument &doc, const char *key, String &value, size_t maximum)
{
    if (!doc[key].is<const char *>())
        return false;
    value = doc[key].as<String>();
    value.trim();
    return value.length() > 0 && value.length() <= maximum;
}

static void testHaIntegration()
{
    StaticJsonDocument<768> doc;
    if (deserializeJson(doc, mws.webserver->arg("plain")) != DeserializationError::Ok)
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"json\"}");
        return;
    }

    String baseUrl;
    String token;
    if (!integrationString(doc, "HA Base URL", baseUrl, 160) || !integrationString(doc, "HA Token", token, 512))
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"ha\"}");
        return;
    }
    while (baseUrl.endsWith("/"))
        baseUrl.remove(baseUrl.length() - 1);
    if (!baseUrl.startsWith("http://"))
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"url\"}");
        return;
    }

    HTTPClient http;
    WiFiClient client;
    if (!http.begin(client, baseUrl + "/api/"))
    {
        sendIntegrationResult(502, "{\"ok\":false,\"error\":\"ha net\"}");
        return;
    }
    http.setTimeout(5000);
    http.addHeader("Authorization", "Bearer " + token);
    http.addHeader("Accept", "application/json");
    int code = http.GET();
    http.end();
    if (code == HTTP_CODE_OK)
        sendIntegrationResult(200, "{\"ok\":true,\"error\":\"\"}");
    else if (code < 0)
        sendIntegrationResult(504, "{\"ok\":false,\"error\":\"ha timeout\"}");
    else
        sendIntegrationResult(502, "{\"ok\":false,\"error\":\"ha rejected\"}");
}

static void testMqttIntegration()
{
    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, mws.webserver->arg("plain")) != DeserializationError::Ok)
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"json\"}");
        return;
    }

    String broker;
    if (!integrationString(doc, "Broker", broker, 128) || !doc["Username"].is<const char *>() ||
        !doc["Password"].is<const char *>() || !doc["Port"].is<uint16_t>())
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"mqtt\"}");
        return;
    }
    const char *username = doc["Username"].as<const char *>();
    const char *password = doc["Password"].as<const char *>();
    uint16_t port = doc["Port"].as<uint16_t>();
    if (strlen(username) > 128 || strlen(password) > 128 || port == 0)
    {
        sendIntegrationResult(400, "{\"ok\":false,\"error\":\"mqtt\"}");
        return;
    }

    WiFiClient probeClient;
    bool connected = probeClient.connect(broker.c_str(), port, 5000);
    probeClient.stop();
    if (connected)
        sendIntegrationResult(200, "{\"ok\":true,\"error\":\"\"}");
    else
        sendIntegrationResult(502, "{\"ok\":false,\"error\":\"mqtt net\"}");
}

static String jsonEscape(const String &value)
{
    String escaped;
    escaped.reserve(value.length() + 8);
    for (size_t i = 0; i < value.length(); i++)
    {
        char c = value[i];
        if (c == '\\' || c == '"')
        {
            escaped += '\\';
            escaped += c;
        }
        else if (c == '\n')
            escaped += F("\\n");
        else if (c == '\r')
            escaped += F("\\r");
        else if (c == '\t')
            escaped += F("\\t");
        else if ((uint8_t)c < 0x20)
            escaped += ' ';
        else
            escaped += c;
    }
    return escaped;
}

static void appendJsonEscapedChar(String &escaped, char c)
{
    if (c == '\\' || c == '"')
    {
        escaped += '\\';
        escaped += c;
    }
    else if (c == '\n')
        escaped += F("\\n");
    else if (c == '\r')
        escaped += F("\\r");
    else if (c == '\t')
        escaped += F("\\t");
    else if (c == '\b')
        escaped += F("\\b");
    else if (c == '\f')
        escaped += F("\\f");
    else if ((uint8_t)c < 0x20)
    {
        const char hex[] = "0123456789abcdef";
        escaped += F("\\u00");
        escaped += hex[((uint8_t)c >> 4) & 0x0F];
        escaped += hex[(uint8_t)c & 0x0F];
    }
    else
        escaped += c;
}

static const __FlashStringHelper *fileContentType(const String &path)
{
    String p = path;
    p.toLowerCase();
    if (p.endsWith(".png"))
        return F("image/png");
    if (p.endsWith(".jpg") || p.endsWith(".jpeg"))
        return F("image/jpeg");
    if (p.endsWith(".gif"))
        return F("image/gif");
    if (p.endsWith(".svg"))
        return F("image/svg+xml");
    if (p.endsWith(".css"))
        return F("text/css");
    if (p.endsWith(".js"))
        return F("application/javascript");
    if (p.endsWith(".html") || p.endsWith(".htm"))
        return F("text/html");
    if (p.endsWith(".json"))
        return F("application/json");
    return F("text/plain");
}

static void sendFileViewJson(const String &path, File &file, size_t size, bool binary)
{
    mws.webserver->setContentLength(CONTENT_LENGTH_UNKNOWN);
    mws.webserver->send(200, F("application/json"), "");
    mws.webserver->sendContent(F("{\"path\":\""));
    mws.webserver->sendContent(jsonEscape(path));
    mws.webserver->sendContent(F("\",\"size\":"));
    mws.webserver->sendContent(String(size));
    mws.webserver->sendContent(F(",\"contentType\":\""));
    mws.webserver->sendContent(fileContentType(path));
    mws.webserver->sendContent(F("\",\"binary\":"));
    mws.webserver->sendContent(binary ? F("true") : F("false"));
    if (!binary)
    {
        mws.webserver->sendContent(F(",\"content\":\""));
        String chunk;
        chunk.reserve(512);
        while (file.available())
        {
            appendJsonEscapedChar(chunk, (char)file.read());
            if (chunk.length() >= 480)
            {
                mws.webserver->sendContent(chunk);
                chunk = "";
            }
        }
        if (chunk.length())
            mws.webserver->sendContent(chunk);
        mws.webserver->sendContent(F("\""));
    }
    mws.webserver->sendContent(F("}"));
}

static bool isTextFileName(const String &path)
{
    String p = path;
    p.toLowerCase();
    return p.endsWith(".json") || p.endsWith(".txt") || p.endsWith(".js") || p.endsWith(".css") || p.endsWith(".html") || p.endsWith(".md") || p.endsWith(".csv") || p.endsWith(".log") || p.endsWith(".xml") || p.endsWith(".svg");
}

static void viewFile()
{
    String path = mws.webserver->arg("path");
    if (!path.startsWith("/"))
        path = "/" + path;
    if (path.indexOf("..") >= 0 || path.endsWith("/"))
    {
        mws.webserver->send(400, F("application/json"), F("{\"error\":\"invalid path\"}"));
        return;
    }
    if (!LittleFS.exists(path))
    {
        mws.webserver->send(404, F("application/json"), F("{\"error\":\"file not found\"}"));
        return;
    }
    File file = LittleFS.open(path, "r");
    if (!file)
    {
        mws.webserver->send(500, F("application/json"), F("{\"error\":\"open failed\"}"));
        return;
    }
    size_t size = file.size();
    bool binary = !isTextFileName(path);
    sendFileViewJson(path, file, size, binary);
    file.close();
}

void ServerManager_::erase()
{
    DisplayManager.HSVtext(0, 6, "RESET", true, 0);
    wifi_config_t conf;
    memset(&conf, 0, sizeof(conf)); // Set all the bytes in the structure to 0
    esp_wifi_set_config(WIFI_IF_STA, &conf);
    LittleFS.format();
    delay(200);
    formatSettings();
    delay(200);
}

void saveHandler()
{
    WebServerClass *webRequest = mws.getRequest();
    ServerManager.getInstance().loadSettings();
    webRequest->send(200);
}

void addHandler()
{

    mws.addHandler("/api/power", HTTP_POST, []()
                   { DisplayManager.powerStateParse(mws.webserver->arg("plain").c_str()); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler(
        "/api/sleep", HTTP_POST, []()
        { 
            mws.webserver->send(200,F("text/plain"),F("OK"));
            DisplayManager.setPower(false);
            PowerManager.sleepParser(mws.webserver->arg("plain").c_str()); });
    mws.addHandler("/api/loop", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getAppsAsJson().c_str()); });
    mws.addHandler("/api/effects", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getEffectNames().c_str()); });
    mws.addHandler("/api/transitions", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getTransitionNames().c_str()); });
    mws.addHandler("/api/reboot", HTTP_ANY, []()
                   { mws.webserver->send(200,F("text/plain"),F("OK")); delay(200); ESP.restart(); });
    mws.addHandler("/api/rtttl", HTTP_POST, []()
                   { mws.webserver->send(200,F("text/plain"),F("OK")); PeripheryManager.playRTTTLString(mws.webserver->arg("plain").c_str()); });
    mws.addHandler("/api/sound", HTTP_POST, []()
                   { if (PeripheryManager.parseSound(mws.webserver->arg("plain").c_str())){
                    mws.webserver->send(200,F("text/plain"),F("OK")); 
                   }else{
                    mws.webserver->send(404,F("text/plain"),F("FileNotFound"));  
                   }; });

    mws.addHandler("/api/moodlight", HTTP_POST, []()
                   {
                    if (DisplayManager.moodlight(mws.webserver->arg("plain").c_str()))
                    {
                        mws.webserver->send(200, F(F("text/plain")), F("OK"));
                    }
                    else
                    {
                        mws.webserver->send(500, F("text/plain"), F("ErrorParsingJson"));
                    } });
    mws.addHandler("/api/notify", HTTP_POST, []()
                   {
                       if (DisplayManager.generateNotification(1,mws.webserver->arg("plain").c_str()))
                       {
                        mws.webserver->send(200, F("text/plain"), F("OK"));
                       }else{
                        mws.webserver->send(500, F("text/plain"), F("ErrorParsingJson"));
                       } });
    mws.addHandler("/api/nextapp", HTTP_ANY, []()
                   { DisplayManager.nextApp(); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/previousapp", HTTP_POST, []()
                   { DisplayManager.previousApp(); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/notify/dismiss", HTTP_ANY, []()
                   { DisplayManager.dismissNotify(); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/apps", HTTP_POST, []()
                   { DisplayManager.updateAppVector(mws.webserver->arg("plain").c_str()); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/apps/uninstall", HTTP_POST, []()
                   { uninstallCustomApp(); });
    mws.addHandler("/api/integrations/test-ha", HTTP_POST, []()
                   { testHaIntegration(); });
    mws.addHandler("/api/integrations/test-mqtt", HTTP_POST, []()
                   { testMqttIntegration(); });
    mws.addHandler(
        "/api/switch", HTTP_POST, []()
        {
        if (DisplayManager.switchToApp(mws.webserver->arg("plain").c_str()))
        {
            mws.webserver->send(200, F("text/plain"), F("OK"));
        }
        else
        {
            mws.webserver->send(500, F("text/plain"), F("FAILED"));
        } });
    mws.addHandler("/api/apps", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getAppsWithIcon().c_str()); });
    mws.addHandler("/api/app-store", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", getAppStoreManifestJson()); });
    mws.addHandler("/api/files/view", HTTP_GET, []()
                   { viewFile(); });
    mws.addHandler("/api/app-store/install", HTTP_POST, []()
                   {
                    String body = mws.webserver->arg("plain");
                    if (!body.startsWith("{") || body.indexOf("\"id\"") < 0)
                    {
                        mws.webserver->send(400, "application/json", "{\"success\":false,\"error\":\"invalid request\"}");
                        return;
                    }

                    String id = body.indexOf("demo-clock") >= 0 ? "demo-clock" : "";
                    const char *appJson = getAppStoreAppJson(id);
                    if (appJson == nullptr)
                    {
                        mws.webserver->send(404, "application/json", "{\"success\":false,\"error\":\"app not found\"}");
                        return;
                    }

                    DisplayManager_::CustomAppInstallResult result = DisplayManager.installCustomAppFromJson(id, appJson);
                    if (result == DisplayManager_::CUSTOM_APP_INSTALL_OK)
                        mws.webserver->send(200, "application/json", "{\"success\":true,\"id\":\"" + id + "\"}");
                    else if (result == DisplayManager_::CUSTOM_APP_INSTALL_DUPLICATE)
                        mws.webserver->send(409, "application/json", "{\"success\":false,\"error\":\"app already installed\"}");
                    else
                        mws.webserver->send(500, "application/json", "{\"success\":false,\"error\":\"error parsing app json\"}");
                   });
    mws.addHandler("/api/settings", HTTP_POST, []()
                   { DisplayManager.setNewSettings(mws.webserver->arg("plain").c_str()); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/erase", HTTP_ANY, []()
                   { ServerManager.erase();  mws.webserver->send(200,F("text/plain"),F("OK"));delay(200); ESP.restart(); });
    mws.addHandler("/api/resetSettings", HTTP_ANY, []()
                   { formatSettings();   mws.webserver->send(200,F("text/plain"),F("OK"));delay(200); ESP.restart(); });
    mws.addHandler("/api/reorder", HTTP_POST, []()
                   { DisplayManager.reorderApps(mws.webserver->arg("plain").c_str()); mws.webserver->send(200,F("text/plain"),F("OK")); });
    mws.addHandler("/api/settings", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getSettings().c_str()); });
    mws.addHandler("/api/custom", HTTP_POST, []()
                   {
                     String name = mws.webserver->arg("name");
                     if (!validCustomAppName(name)){
                         mws.webserver->send(400,F("text/plain"),F("InvalidName"));
                     }else if (DisplayManager.parseCustomPage(name,mws.webserver->arg("plain").c_str(),false)){
                         mws.webserver->send(200,F("text/plain"),F("OK"));
                     }else{
                         mws.webserver->send(500,F("text/plain"),F("ErrorParsingJson"));
                     } });
    mws.addHandler("/api/custom/refresh", HTTP_POST, []()
                   { refreshCustomApp(); });
    mws.addHandler("/api/stats", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.getStats().c_str()); });
    mws.addHandler("/api/screen", HTTP_GET, []()
                   { mws.webserver->send_P(200, "application/json", DisplayManager.ledsAsJson().c_str()); });
    mws.addHandler("/api/indicator1", HTTP_POST, []()
                   { 
                    if (DisplayManager.indicatorParser(1,mws.webserver->arg("plain").c_str())){
                     mws.webserver->send(200,F("text/plain"),F("OK")); 
                    }else{
                         mws.webserver->send(500,F("text/plain"),F("ErrorParsingJson")); 
                    } });
    mws.addHandler("/api/indicator2", HTTP_POST, []()
                   { 
                    if (DisplayManager.indicatorParser(2,mws.webserver->arg("plain").c_str())){
                     mws.webserver->send(200,F("text/plain"),F("OK")); 
                    }else{
                         mws.webserver->send(500,F("text/plain"),F("ErrorParsingJson")); 
                    } });
    mws.addHandler("/api/indicator3", HTTP_POST, []()
                   { 
                    if (DisplayManager.indicatorParser(3,mws.webserver->arg("plain").c_str())){
                     mws.webserver->send(200,F("text/plain"),F("OK")); 
                    }else{
                         mws.webserver->send(500,F("text/plain"),F("ErrorParsingJson")); 
                    } });
    mws.addHandler("/api/update", HTTP_GET, []()
                   {
                    UpdateManager.checkUpdate(false);
                    mws.webserver->send(200, F("application/json"), UpdateManager.statusJson());
                   });
    mws.addHandler("/api/update/target", HTTP_GET, []()
                   {
                    String response = String(F("{\"ok\":true,\"target\":\"")) + manualFirmwareTarget + F("\"}");
                    mws.webserver->send(200, F("application/json"), response);
                   });
    mws.addHandler("/api/doupdate", HTTP_POST, []()
                   {
                    if (!UpdateManager.hasCandidate())
                    {
                        mws.webserver->send(409, F("application/json"), F("{\"ok\":false,\"error\":\"candidate absent\"}"));
                        return;
                    }
                    mws.webserver->send(202, F("application/json"), F("{\"ok\":true,\"status\":\"starting\"}"));
                    UpdateManager.updateFirmware();
                   });
    mws.addHandler("/api/update/upload", HTTP_POST, []()
                   { finishManualFirmwareUpload(); }, []()
                   { handleManualFirmwareUpload(); });
    mws.addHandler("/api/r2d2", HTTP_POST, []()
                   { PeripheryManager.r2d2(mws.webserver->arg("plain").c_str()); mws.webserver->send(200,F("text/plain"),F("OK")); });
    setupAwtrixLightWebRoutes(mws);
}

void ServerManager_::setup()
{
    esp_wifi_set_max_tx_power(80); // 82 * 0.25 dBm = 20.5 dBm
    esp_wifi_set_ps(WIFI_PS_NONE); // Power Saving deaktivieren
    if (!local_IP.fromString(NET_IP) || !gateway.fromString(NET_GW) || !subnet.fromString(NET_SN) || !primaryDNS.fromString(NET_PDNS) || !secondaryDNS.fromString(NET_SDNS))
        NET_STATIC = false;
    if (NET_STATIC)
    {
        WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
    }
    WiFi.setHostname(HOSTNAME.c_str()); // define hostname
    myIP = mws.startWiFi(AP_TIMEOUT * 1000, HOSTNAME.c_str(), "12345678");
    isConnected = !(myIP == IPAddress(192, 168, 4, 1));
    if (DEBUG_MODE)
        DEBUG_PRINTF("My IP: %d.%d.%d.%d", myIP[0], myIP[1], myIP[2], myIP[3]);
    mws.setAuth(AUTH_USER, AUTH_PASS);
    if (isConnected)
    {
        mws.addOptionBox("Network");
        mws.addOption("Static IP", NET_STATIC);
        mws.addOption("Local IP", NET_IP);
        mws.addOption("Gateway", NET_GW);
        mws.addOption("Subnet", NET_SN);
        mws.addOption("Primary DNS", NET_PDNS);
        mws.addOption("Secondary DNS", NET_SDNS);
        mws.addOptionBox("MQTT");
        mws.addOption("Broker", MQTT_HOST);
        mws.addOption("Port", MQTT_PORT);
        mws.addOption("Username", MQTT_USER);
        mws.addOption("Password", MQTT_PASS);
        mws.addOption("Prefix", MQTT_PREFIX);
        mws.addOption("Homeassistant Discovery", HA_DISCOVERY);
        mws.addOption("HA Prefix", HA_PREFIX);
        mws.addOption("HA Base URL", HA_BASE_URL);
        mws.addOption("HA Token", HA_TOKEN);
        mws.addOptionBox("Time");
        mws.addOption("NTP Server", NTP_SERVER);
        mws.addOption("Timezone", NTP_TZ);
        mws.addHTML("<p>Find your timezone at <a href='https://github.com/nayarsystems/posix_tz_db/blob/master/zones.csv' target='_blank' rel='noopener noreferrer'>posix_tz_db</a>.</p>", "tz_link");
        mws.addOptionBox("Icons");
        mws.addOptionBox("Auth");
        mws.addOption("Auth Username", AUTH_USER);
        mws.addOption("Auth Password", AUTH_PASS);
        mws.addHandler("/save", HTTP_POST, saveHandler);
        addHandler();
        udp.begin(localUdpPort);
        if (DEBUG_MODE)
            DEBUG_PRINTLN(F("Webserver loaded"));
    }
    mws.addHandler("/version", HTTP_GET, versionHandler);
    mws.begin(WEB_PORT);
    beginAwtrixLightRuntime();

    configTzTime(NTP_TZ.c_str(), NTP_SERVER.c_str());
    tm timeInfo;
    getLocalTime(&timeInfo);
    TCPserver.begin();
    TCPserver.setNoDelay(true);
}

void ServerManager_::tick()
{
    mws.run();
    tickAwtrixLightRuntime();

    if (!AP_MODE)
    {
        int packetSize = udp.parsePacket();
        if (packetSize)
        {
            int len = udp.read(incomingPacket, 255);
            if (len > 0)
            {
                incomingPacket[len] = 0;
            }
            if (strcmp(incomingPacket, "FIND_AWTRIX") == 0)
            {
                udp.beginPacket(udp.remoteIP(), 4211);
                if (WEB_PORT != 80)
                {
                    char buffer[128];
                    sprintf(buffer, "%s:%d", HOSTNAME.c_str(), WEB_PORT);
                    udp.printf(buffer);
                }
                else
                {
                    udp.printf(HOSTNAME.c_str());
                }

                udp.endPacket();
            }
        }
    }

    if (!currentClient || !currentClient.connected()) {
        if (TCPserver.hasClient()) {
            if (currentClient) {
                currentClient.stop();
                Serial.println("Vorheriger Client getrennt, um neuen Client zu akzeptieren.");
            }
            currentClient = TCPserver.available();
            Serial.println("Neuer Client verbunden.");
        }
    }

    if (currentClient && currentClient.connected()) {
#ifndef awtrix2_upgrade
        while (currentClient.available()) {
            char incomingByte = currentClient.read();            
            if (incomingByte == '\n') {
                dataBuffer[bufferIndex] = '\0';               
                GameManager.ControllerInput(dataBuffer);
                bufferIndex = 0;
            }
            else if (incomingByte != '\r') {
                if (bufferIndex < BUFFER_SIZE - 1) {
                    dataBuffer[bufferIndex++] = incomingByte;
                }
                else {
                    bufferIndex = 0;
                }
            }
        }
#else
        while (currentClient.available())
            currentClient.read();
#endif
    }
}

void ServerManager_::sendTCP(String message)
{
    if (currentClient && currentClient.connected()) {
        currentClient.print(message);
    }
}

void ServerManager_::loadSettings()
{
    if (LittleFS.exists("/DoNotTouch.json"))
    {
        File file = LittleFS.open("/DoNotTouch.json", "r");
        DynamicJsonDocument doc(file.size() * 1.33);
        DeserializationError error = deserializeJson(doc, file);
        if (error)
            return;

        NTP_SERVER = doc["NTP Server"].as<String>();
        NTP_TZ = doc["Timezone"].as<String>();
        MQTT_HOST = doc["Broker"].as<String>();
        MQTT_PORT = doc["Port"].as<uint16_t>();
        MQTT_USER = doc["Username"].as<String>();
        MQTT_PASS = doc["Password"].as<String>();
        MQTT_PREFIX = doc["Prefix"].as<String>();
        MQTT_PREFIX.trim();
        if (doc["HA Prefix"].is<String>())
            HA_PREFIX = doc["HA Prefix"].as<String>();
        if (doc["HA Base URL"].is<String>())
            HA_BASE_URL = doc["HA Base URL"].as<String>();
        if (doc["HA Token"].is<String>())
            HA_TOKEN = doc["HA Token"].as<String>();
        NET_STATIC = doc["Static IP"];
        HA_DISCOVERY = doc["Homeassistant Discovery"];
        NET_IP = doc["Local IP"].as<String>();
        NET_GW = doc["Gateway"].as<String>();
        NET_SN = doc["Subnet"].as<String>();
        NET_PDNS = doc["Primary DNS"].as<String>();
        NET_SDNS = doc["Secondary DNS"].as<String>();
        if (doc["Auth Username"].is<String>())
            AUTH_USER = doc["Auth Username"].as<String>();
        if (doc["Auth Password"].is<String>())
            AUTH_PASS = doc["Auth Password"].as<String>();

        file.close();
        DisplayManager.applyAllSettings();
        if (DEBUG_MODE)
            DEBUG_PRINTLN(F("Webserver configuration loaded"));
        doc.clear();
        return;
    }
    else if (DEBUG_MODE)
        DEBUG_PRINTLN(F("Webserver configuration file not exist"));
    return;
}

void ServerManager_::sendButton(byte btn, bool state)
{
    setAwtrixLightRuntimeButton(btn, state);
    if (BUTTON_CALLBACK == "")
        return;
    static bool btn0State, btn1State, btn2State;
    String payload;
    switch (btn)
    {
    case 0:
        if (btn0State != state)
        {
            btn0State = state;
            payload = "button=left&state=" + String(state) + "&uid=" + uniqueID;
        }
        break;
    case 1:
        if (btn1State != state)
        {
            btn1State = state;
            payload = "button=middle&state=" + String(state) + "&uid=" + uniqueID;
        }
        break;
    case 2:
        if (btn2State != state)
        {
            btn2State = state;
            payload = "button=right&state=" + String(state) + "&uid=" + uniqueID;
        }
        break;
    default:
        return;
    }
    if (!payload.isEmpty())
    {
        HTTPClient http;
        http.begin(BUTTON_CALLBACK);
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        http.POST(payload);
        http.end();
    }
}
