function legacySettingGroups() {
  let z=lang==='zh';
  return  {
    network:[ {
      title:z?'网络':'Network',
      fields:[['Static IP',
      z?'静态 IP':'Static IP',
      'checkbox'],
      ['Local IP',
      z?'本机 IP':'Local IP',
      'text'],
      ['Gateway',
      z?'网关':'Gateway',
      'text'],
      ['Subnet',
      z?'子网掩码':'Subnet',
      'text'],
      ['Primary DNS',
      z?'首选 DNS':'Primary DNS',
      'text'],
      ['Secondary DNS',
      z?'备用 DNS':'Secondary DNS',
      'text']]
    }],
    time:[],
    integrations:[ {
      title:'MQTT',
      fields:[['Broker',
      z?'服务器':'Broker',
      'text'],
      ['Port',
      z?'端口':'Port',
      'number'],
      ['Username',
      z?'用户名':'Username',
      'text'],
      ['Password',
      z?'密码':'Password',
      'password'],
      ['Prefix',
      z?'主题前缀':'Prefix',
      'text'],
      ['Homeassistant Discovery',
      'Homeassistant Discovery',
      'checkbox']]
    }],
    auth:[ {
      title:z?'账号':'Auth',
      fields:[['Auth Username',
      z?'账号':'Auth Username',
      'text'],
      ['Auth Password',
      z?'密码':'Auth Password',
      'password']]
    }]
  }
}
