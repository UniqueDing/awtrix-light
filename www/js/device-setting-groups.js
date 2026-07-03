function deviceSettingGroups() {
  return  {
    device: {
      display:[ {
        title:t.matrixDisplay,
        fields:[['MATP',
        t.matrixPower,
        'checkbox'],
        ['ABRI',
        t.autoBrightness,
        'checkbox'],
        ['BRI',
        t.brightness,
        'number'],
        ['GAMMA',
        t.gamma,
        'number'],
        ['CCORRECTION',
        t.colorCorrection,
        'colorString'],
        ['CTEMP',
        t.colorTemperature,
        'colorString'],
        ['OVERLAY',
        t.overlay,
        'select',
        [['clear',
        'clear'],
        ['snow',
        'snow'],
        ['rain',
        'rain'],
        ['drizzle',
        'drizzle'],
        ['storm',
        'storm'],
        ['thunder',
        'thunder'],
        ['frost',
        'frost']]]]
      }],
      sound:[ {
        title:t.soundOther,
        fields:[['SOUND',
        t.sound,
        'checkbox'],
        ['VOL',
        t.volume,
        'number'],
        ['BLOCKN',
        t.blockNav,
        'checkbox'],
        ['MAT',
        t.matrixLayout,
        'number']]
      }]
    },
    integrations: {
      homeAssistant:[ {
        title:'Home Assistant',
        fields:[['HA_ENABLED',
        'Home Assistant',
        'checkbox'],
        ['HA_BASE_URL',
        'HA URL',
        'text'],
        ['HA_TOKEN',
        'HA Token',
        'password'],
        ['HA_PREFIX',
        'HA Prefix',
        'text']]
      }]
    }
  }
}
