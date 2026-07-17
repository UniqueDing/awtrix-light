#!/usr/bin/env python3

from pathlib import Path


root = Path(__file__).resolve().parents[1]
source_path = root / "src/ServerManager.cpp"
mirror_path = root / "awtrix3/src/ServerManager.cpp"
assert source_path.read_bytes() == mirror_path.read_bytes()

source = source_path.read_text()

update_start = source.index('mws.addHandler("/api/update", HTTP_GET')
target_start = source.index('mws.addHandler("/api/update/target", HTTP_GET')
doupdate_start = source.index('mws.addHandler("/api/doupdate", HTTP_POST')
doupdate_end = source.index('mws.addHandler("/api/r2d2"', doupdate_start)
update_route = source[update_start:target_start]
target_route = source[target_start:doupdate_start]
doupdate_route = source[doupdate_start:doupdate_end]
upload_start = source.index('mws.addHandler("/api/update/upload", HTTP_POST')
upload_end = source.index('mws.addHandler("/api/r2d2"', upload_start)
upload_route = source[upload_start:upload_end]

assert 'UpdateManager.checkUpdate(false);' in update_route
assert 'UpdateManager.statusJson()' in update_route
assert 'mws.webserver->send(200, F("application/json")' in update_route
assert 'UpdateManager.updateFirmware()' not in update_route

assert 'String response = String(F("{\\"ok\\":true,\\"target\\":\\"")) + manualFirmwareTarget + F("\\"}");' in target_route
assert 'mws.webserver->send(200, F("application/json"), response);' in target_route
assert 'UpdateManager' not in target_route
assert 'HTTPClient' not in target_route

assert 'UpdateManager.hasCandidate()' in doupdate_route
assert 'mws.webserver->send(409, F("application/json")' in doupdate_route
assert '\\"candidate absent\\"' in doupdate_route
assert 'mws.webserver->send(202, F("application/json")' in doupdate_route
assert 'UpdateManager.updateFirmware();' in doupdate_route
assert 'checkUpdate(' not in doupdate_route

assert 'handleManualFirmwareUpload();' in upload_route
assert 'finishManualFirmwareUpload();' in upload_route
assert 'upload.name != "firmware"' in source
assert 'manualFirmwareImageLimit = 1310720' in source
assert 'Update.begin(manualFirmwareImageLimit, U_FLASH)' in source
assert 'upload.currentSize > manualFirmwareImageLimit - manualFirmwareUpload.bytes' in source
assert 'Update.write(upload.buf, upload.currentSize) != upload.currentSize' in source
assert 'Update.hasError()' in source
assert 'Update.abort();' in source
assert 'UPLOAD_FILE_ABORTED' in source
assert 'Update.end(true)' in source
assert 'mws.webserver->send(202, F("application/json")' in source
assert 'delay(200);' in source
assert 'ESP.restart();' in source
assert 'manualFirmwareTarget = "ulanzi"' in source
assert 'manualFirmwareTarget = "awtrix2-upgrade"' in source
assert '#error "Unsupported OTA target"' in source

upload_patch = (root / "patches/013-webserver-upload-handler.patch").read_text()
assert 'authMiddleware(fn), authMiddleware(uploadFn)' in upload_patch
assert 'void addHandler(const Uri &uri, HTTPMethod method, WebServerClass::THandlerFunction fn, WebServerClass::THandlerFunction uploadFn);' in upload_patch

print("ota routes: ok")
