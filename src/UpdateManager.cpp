#include "UpdateManager.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Update.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <mbedtls/sha256.h>
#include "cert.h"
#include "DisplayManager.h"
#include "Globals.h"

#if defined(ULANZI) && defined(awtrix2_upgrade)
#error "Exactly one OTA target must be selected"
#elif defined(ULANZI)
static const char *const otaTarget = "ulanzi";
static const uint32_t otaImageLimit = 1310720;
#elif defined(awtrix2_upgrade)
static const char *const otaTarget = "awtrix2-upgrade";
static const uint32_t otaImageLimit = 1310720;
#else
#error "Unsupported OTA target"
#endif

static const char *const manifestUrl = "https://github.com/uniqueding/awtrix-light/releases/latest/download/ota-manifest.json";
static const char *const releaseUrlPrefix = "https://github.com/uniqueding/awtrix-light/releases/download/";

UpdateManager_ &UpdateManager_::getInstance()
{
    static UpdateManager_ instance;
    return instance;
}

UpdateManager_ &UpdateManager = UpdateManager.getInstance();

static void updateProgress(uint32_t current, uint32_t total)
{
    DisplayManager.clear();
    int progress = total == 0 ? 0 : (current * 100) / total;
    char progressStr[5];
    snprintf(progressStr, sizeof(progressStr), "%d%%", progress);
    DisplayManager.resetTextColor();
    DisplayManager.printText(0, 6, progressStr, true, false);
    DisplayManager.drawProgressBar(0, 7, progress, 0x00FF00, 0xFFFFFF);
    DisplayManager.show();
}

static void updateFailure()
{
    DisplayManager.clear();
    DisplayManager.printText(0, 6, "FAIL", true, true);
    DisplayManager.show();
}

static bool numericPart(const String &value, size_t &offset, uint32_t &part)
{
    size_t start = offset;
    part = 0;
    while (offset < value.length() && value[offset] >= '0' && value[offset] <= '9')
    {
        uint8_t digit = value[offset] - '0';
        if (part > (UINT32_MAX - digit) / 10)
            return false;
        part = part * 10 + digit;
        offset++;
    }
    return offset > start;
}

static bool parseLightVersion(const String &value, uint32_t parts[3])
{
    size_t offset = 0;
    for (size_t index = 0; index < 3; index++)
    {
        if (!numericPart(value, offset, parts[index]))
            return false;
        if (index < 2)
        {
            if (offset >= value.length() || value[offset++] != '.')
                return false;
        }
    }
    return value.substring(offset) == "-light";
}

static bool isNewerVersion(const String &available, const char *current)
{
    uint32_t availableParts[3];
    uint32_t currentParts[3];
    if (!parseLightVersion(available, availableParts) || !parseLightVersion(String(current), currentParts))
        return false;
    for (size_t index = 0; index < 3; index++)
    {
        if (availableParts[index] != currentParts[index])
            return availableParts[index] > currentParts[index];
    }
    return false;
}

static bool validSha256(const char *value)
{
    if (value == nullptr || strlen(value) != 64)
        return false;
    for (size_t index = 0; index < 64; index++)
    {
        char character = value[index];
        if (!((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f')))
            return false;
    }
    return true;
}

static uint8_t hexValue(char character)
{
    if (character >= '0' && character <= '9')
        return character - '0';
    if (character >= 'a' && character <= 'f')
        return character - 'a' + 10;
    return 0;
}

static bool constantTimeSha256Matches(const uint8_t actual[32], const String &expected)
{
    uint8_t difference = 0;
    for (size_t index = 0; index < 32; index++)
    {
        uint8_t expectedByte = (hexValue(expected[index * 2]) << 4) | hexValue(expected[index * 2 + 1]);
        difference |= actual[index] ^ expectedByte;
    }
    return difference == 0;
}

static String expectedAssetName(const String &version)
{
    return "awtrix-light-" + version + "-" + otaTarget + ".bin";
}

static String expectedAssetUrl(const String &version)
{
    String asset = expectedAssetName(version);
    return String(releaseUrlPrefix) + "v" + version + "/" + asset;
}

static void showCheckMessage(const char *message)
{
    DisplayManager.clear();
    DisplayManager.resetTextColor();
    DisplayManager.printText(0, 6, message, true, true);
    DisplayManager.show();
}

bool UpdateManager_::checkUpdate(bool withScreen)
{
    candidate = Candidate();
    availableVersion = "";
    lastError = "";
    lastCheckOk = false;
    UPDATE_AVAILABLE = false;

    if (withScreen)
        showCheckMessage("CHECK");

    WiFiClientSecure client;
    client.setCACert(rootCACertificate);
    HTTPClient https;
    if (!https.begin(client, manifestUrl))
    {
        lastError = "manifest connection";
        if (withScreen)
            showCheckMessage("ERR CNCT");
        return false;
    }

    https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    int httpCode = https.GET();
    if (httpCode != HTTP_CODE_OK)
    {
        lastError = "manifest http";
        https.end();
        if (withScreen)
            showCheckMessage("ERR CNCT");
        return false;
    }

    DynamicJsonDocument manifest(2048);
    DeserializationError jsonError = deserializeJson(manifest, https.getStream());
    https.end();
    if (jsonError != DeserializationError::Ok)
    {
        lastError = "manifest json";
        if (withScreen)
            showCheckMessage("ERR DATA");
        return false;
    }

    if (!manifest["schema"].is<uint8_t>() || manifest["schema"].as<uint8_t>() != 1 ||
        !manifest["family"].is<const char *>() || String(manifest["family"].as<const char *>()) != "awtrix-light" ||
        !manifest["version"].is<const char *>() || !manifest["targets"].is<JsonArray>())
    {
        lastError = "manifest policy";
        if (withScreen)
            showCheckMessage("ERR DATA");
        return false;
    }

    String version = manifest["version"].as<String>();
    uint32_t versionParts[3];
    if (!parseLightVersion(version, versionParts))
    {
        lastError = "manifest version";
        if (withScreen)
            showCheckMessage("ERR DATA");
        return false;
    }
    availableVersion = version;

    JsonObject selected;
    uint8_t matchingTargets = 0;
    for (JsonObject target : manifest["targets"].as<JsonArray>())
    {
        if (target["target"].is<const char *>() && String(target["target"].as<const char *>()) == otaTarget)
        {
            selected = target;
            matchingTargets++;
        }
    }

    if (matchingTargets != 1 || selected.isNull() || !selected["asset"].is<const char *>() || !selected["size"].is<uint32_t>() || !selected["sha256"].is<const char *>())
    {
        lastError = "target missing";
        if (withScreen)
            showCheckMessage("ERR DATA");
        return false;
    }

    String asset = selected["asset"].as<String>();
    String sha256 = selected["sha256"].as<String>();
    uint32_t size = selected["size"].as<uint32_t>();
    if (asset != expectedAssetName(version) || size == 0 || size > otaImageLimit || !validSha256(sha256.c_str()))
    {
        lastError = "target policy";
        if (withScreen)
            showCheckMessage("ERR DATA");
        return false;
    }

    lastCheckOk = true;
    if (!isNewerVersion(version, VERSION))
    {
        if (withScreen)
            showCheckMessage("NO UP :(");
        return false;
    }

    candidate.version = version;
    candidate.asset = asset;
    candidate.sha256 = sha256;
    candidate.size = size;
    candidate.valid = true;
    UPDATE_AVAILABLE = true;
    return true;
}

bool UpdateManager_::hasCandidate() const
{
    return candidate.valid;
}

String UpdateManager_::statusJson() const
{
    return "{\"ok\":" + String(lastCheckOk ? "true" : "false") +
           ",\"updateAvailable\":" + String(candidate.valid ? "true" : "false") +
           ",\"currentVersion\":\"" + VERSION +
           "\",\"availableVersion\":\"" + availableVersion +
           "\",\"target\":\"" + otaTarget +
           "\",\"error\":\"" + lastError + "\"}";
}

void UpdateManager_::updateFirmware()
{
    if (!candidate.valid)
    {
        lastError = "candidate absent";
        Update.abort();
        updateFailure();
        return;
    }

    WiFiClientSecure client;
    client.setCACert(rootCACertificate);
    HTTPClient https;
    String assetUrl = expectedAssetUrl(candidate.version);
    if (!https.begin(client, assetUrl))
    {
        lastError = "asset connection";
        Update.abort();
        updateFailure();
        return;
    }

    https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    int httpCode = https.GET();
    int contentLength = https.getSize();
    if (httpCode != HTTP_CODE_OK || contentLength < 0 || static_cast<uint32_t>(contentLength) != candidate.size || candidate.size > otaImageLimit)
    {
        lastError = "asset length";
        https.end();
        Update.abort();
        updateFailure();
        return;
    }

    if (!Update.begin(candidate.size, U_FLASH))
    {
        lastError = "flash begin";
        https.end();
        Update.abort();
        updateFailure();
        return;
    }

    bool success = false;
    uint32_t written = 0;
    uint8_t buffer[1024];
    uint8_t digest[32];
    mbedtls_sha256_context sha256;
    mbedtls_sha256_init(&sha256);
    int hashResult = mbedtls_sha256_starts_ret(&sha256, 0);
    WiFiClient *stream = https.getStreamPtr();
    while (hashResult == 0 && written < candidate.size)
    {
        size_t wanted = min(sizeof(buffer), static_cast<size_t>(candidate.size - written));
        size_t received = stream->readBytes(buffer, wanted);
        if (received != wanted || Update.write(buffer, received) != received)
            break;
        hashResult = mbedtls_sha256_update_ret(&sha256, buffer, received);
        written += received;
        updateProgress(written, candidate.size);
    }
    if (hashResult == 0 && written == candidate.size)
        hashResult = mbedtls_sha256_finish_ret(&sha256, digest);
    mbedtls_sha256_free(&sha256);

    if (hashResult == 0 && written == candidate.size && constantTimeSha256Matches(digest, candidate.sha256) && Update.end(true))
        success = true;
    else
        Update.abort();
    https.end();

    if (!success)
    {
        lastError = "asset verification";
        updateFailure();
        return;
    }

    candidate = Candidate();
    UPDATE_AVAILABLE = false;
    lastError = "";
    ESP.restart();
}

void UpdateManager_::setup()
{
}
