#!/usr/bin/env python3

from pathlib import Path


root = Path(__file__).resolve().parents[1]
source = (root / "src/UpdateManager.cpp").read_text()
mirror = (root / "awtrix3/src/UpdateManager.cpp").read_text()
header = (root / "src/UpdateManager.h").read_text()
header_mirror = (root / "awtrix3/src/UpdateManager.h").read_text()

assert source == mirror
assert header == header_mirror
assert "Blueforcer" not in source
assert "HTTPUpdate.h" not in source
assert "setInsecure" not in source
assert 'https://github.com/uniqueding/awtrix-light/releases/latest/download/ota-manifest.json' in source
assert 'https://github.com/uniqueding/awtrix-light/releases/download/' in source
assert '#elif defined(ULANZI)' in source
assert 'otaTarget = "ulanzi"' in source
assert '#elif defined(awtrix2_upgrade)' in source
assert 'otaTarget = "awtrix2-upgrade"' in source
assert '#error "Unsupported OTA target"' in source
assert source.count('otaImageLimit = 1310720') == 2
assert 'return "awtrix-light-" + version + "-" + otaTarget + ".bin";' in source
assert 'return String(releaseUrlPrefix) + "v" + version + "/" + asset;' in source
assert 'return String(releaseUrlPrefix) + version + "/" + asset;' not in source
assert 'String assetUrl = expectedAssetUrl(candidate.version);' in source
assert 'client.setCACert(rootCACertificate);' in source
assert 'parseLightVersion' in source and 'isNewerVersion' in source
assert 'manifest["schema"].as<uint8_t>() != 1' in source
assert 'manifest["family"].as<const char *>()' in source
assert 'manifest["targets"].is<JsonArray>()' in source
assert 'uint8_t matchingTargets = 0;' in source
assert 'matchingTargets++;' in source
assert 'matchingTargets != 1 || selected.isNull()' in source
assert 'asset != expectedAssetName(version)' in source
assert 'size == 0 || size > otaImageLimit' in source
assert 'validSha256(sha256.c_str())' in source
assert "(character >= 'A' && character <= 'F')" not in source
assert 'httpCode != HTTP_CODE_OK || contentLength < 0' in source
assert 'static_cast<uint32_t>(contentLength) != candidate.size' in source
assert 'Update.begin(candidate.size, U_FLASH)' in source
assert 'uint8_t buffer[1024];' in source
assert 'mbedtls_sha256_update_ret' in source
assert 'constantTimeSha256Matches' in source
assert 'Update.end(true)' in source
assert 'Update.abort();' in source
assert 'bool hasCandidate() const;' in header
assert 'String statusJson() const;' in header

print("ota release contract: ok")
