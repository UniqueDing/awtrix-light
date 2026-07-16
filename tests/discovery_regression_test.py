#!/usr/bin/env python3

from pathlib import Path


root = Path(__file__).resolve().parents[1]
source = (root / "src/ServerManager.cpp").read_text()
mirror = (root / "awtrix3/src/ServerManager.cpp").read_text()
webserver_header = (root / "awtrix3/lib/webserver/esp-fs-webserver.h").read_text()
webserver_source = (root / "awtrix3/lib/webserver/esp-fs-webserver.cpp").read_text()

assert source == mirror
for forbidden in ("ESPmDNS", "ESP8266mDNS", "MDNS.begin", "MDNS.addService", "MDNS.addServiceTxt"):
    assert forbidden not in source
    assert forbidden not in webserver_header

assert "WiFi.setHostname(HOSTNAME.c_str())" in source
assert "udp.begin(localUdpPort);" in source
assert "unsigned int localUdpPort = 4210;" in source
assert 'strcmp(incomingPacket, "FIND_AWTRIX") == 0' in source
assert "udp.beginPacket(udp.remoteIP(), 4211);" in source
assert "#include <DNSServer.h>" in webserver_header
assert "DNSServer m_dnsServer;" in webserver_header
assert "m_dnsServer.start(53, \"*\", WiFi.softAPIP());" in webserver_source
assert "m_dnsServer.processNextRequest();" in webserver_source

print("discovery regression: ok")
