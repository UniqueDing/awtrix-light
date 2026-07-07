function legacySettingGroups() {
  let z = lang === 'zh';
  return {
    network: [
      {
        title: t.network,
        fields: [
          ['Static IP', t.staticIp, 'checkbox'],
          ['Local IP', t.localIp, 'text'],
          ['Gateway', t.gateway, 'text'],
          ['Subnet', t.subnet, 'text'],
          ['Primary DNS', t.primaryDns, 'text'],
          ['Secondary DNS', t.secondaryDns, 'text'],
        ],
      },
    ],
    time: [],
    integrations: [
      {
        title: 'MQTT',
        fields: [
          ['Broker', t.broker, 'text'],
          ['Port', t.port, 'number'],
          ['Username', t.username, 'text'],
          ['Password', t.password, 'password'],
          ['Prefix', t.topicPrefix, 'text'],
          ['Homeassistant Discovery', 'Homeassistant Discovery', 'checkbox'],
          ['HA Prefix', 'HA Discovery Prefix', 'text'],
          ['HA Base URL', 'HA Base URL', 'text'],
          ['HA Token', 'HA Token', 'password'],
        ],
      },
    ],
    auth: [
      {
        title: t.auth,
        fields: [
          ['Auth Username', t.authUsername, 'text'],
          ['Auth Password', t.authPassword, 'password'],
        ],
      },
    ],
  };
}
