function legacySettingGroups() {
  return {
    network: [
      {
        title: t.network,
        fields: [
          ["Static IP", t.staticIp, "checkbox"],
          ["Local IP", t.localIp, "text"],
          ["Gateway", t.gateway, "text"],
          ["Subnet", t.subnet, "text"],
          ["Primary DNS", t.primaryDns, "text"],
          ["Secondary DNS", t.secondaryDns, "text"],
        ],
      },
    ],
    time: [],
    integrations: [
      {
        title: "MQTT",
        actions: [{ label: t.mqttTest, test: "mqtt" }],
        fields: [
          ["Broker", t.broker, "text"],
          ["Port", t.port, "number"],
          ["Username", t.username, "text"],
          ["Password", t.password, "password"],
          ["Prefix", t.topicPrefix, "text"],
          ["Homeassistant Discovery", "Homeassistant Discovery", "checkbox"],
        ],
      },
      {
        title: t.homeAssistant,
        actions: [{ label: t.haTest, test: "ha" }],
        fields: [
          ["HA Prefix", t.haDiscoveryPrefix, "text"],
          ["HA Base URL", t.haBaseUrl, "text"],
          ["HA Token", t.haToken, "password"],
        ],
      },
    ],
    auth: [
      {
        title: t.auth,
        fields: [
          ["Auth Username", t.authUsername, "text"],
          ["Auth Password", t.authPassword, "password"],
        ],
      },
    ],
  };
}
