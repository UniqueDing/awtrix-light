#!/usr/bin/env python3

from pathlib import Path


root = Path(__file__).resolve().parents[1]
source = (root / "src/ServerManager.cpp").read_text()
ui = (root / "www/js/settings-render-wifi.js").read_text()

assert 'mws.addHandler("/api/integrations/test-ha", HTTP_POST' in source
assert 'mws.addHandler("/api/integrations/test-mqtt", HTTP_POST' in source
assert '"{\\\"ok\\\":true,\\\"error\\\":\\\"\\\"}"' in source
assert '"{\\\"ok\\\":false,\\\"error\\\":' in source
assert 'sendIntegrationResult(400,' in source
assert 'sendIntegrationResult(502,' in source
assert 'sendIntegrationResult(504,' in source

ha = source[source.index("static void testHaIntegration()") : source.index("static void testMqttIntegration()")]
assert 'integrationString(doc, "HA Base URL", baseUrl, 160)' in ha
assert 'integrationString(doc, "HA Token", token, 512)' in ha
assert 'while (baseUrl.endsWith("/"))' in ha
assert 'baseUrl.startsWith("http://")' in ha
assert 'http.begin(client, baseUrl + "/api/")' in ha
assert 'http.setTimeout(5000);' in ha
assert 'http.addHeader("Authorization", "Bearer " + token);' in ha
assert 'int code = http.GET();' in ha
assert 'http.end();' in ha
assert 'getString' not in ha and 'HA_BASE_URL' not in ha and 'HA_TOKEN' not in ha

mqtt = source[source.index("static void testMqttIntegration()") : source.index("static String jsonEscape")]
# MQTT test success means only request-local broker TCP reachability, not MQTT authentication.
for key in ('"Broker"', '"Port"', '"Username"', '"Password"'):
    assert key in mqtt
assert 'WiFiClient probeClient;' in mqtt
assert 'probeClient.connect(broker.c_str(), port, 5000)' in mqtt
assert 'probeClient.stop();' in mqtt
assert 'strlen(username) > 128 || strlen(password) > 128 || port == 0' in mqtt
assert 'PubSubClient' not in mqtt
assert 'HAMqtt mqtt' not in mqtt and 'mqtt.' not in mqtt
assert 'publish(' not in mqtt and 'subscribe(' not in mqtt
assert 'MQTT_HOST' not in mqtt and 'MQTT_PORT' not in mqtt

assert 'Broker: settingInputValue("Broker")' in ui
assert 'Port: settingInputValue("Port")' in ui
assert 'Username: settingInputValue("Username")' in ui
assert 'Password: settingInputValue("Password")' in ui
assert '"HA Base URL": settingInputValue("HA Base URL")' in ui
assert '"HA Token": settingInputValue("HA Token")' in ui
assert 'fetch("/api/integrations/test-" + type' in ui

print("integration test routes: ok")
