{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "awtrix3-wokwi-dev";

  packages = with pkgs; [
    platformio
    esptool
    nodejs
    vscodium
    sudo
    curl
    git
    jq
    unzip
    cacert
    openssl
    pkg-config
    libusb1
    ncurses
    zlib
  ];

  shellHook = ''
    export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
    export GIT_SSL_CAINFO=$SSL_CERT_FILE
    export WOKWI_HOME="$PWD/.wokwi"
    export PATH="$WOKWI_HOME/bin:$PATH"

    pio-build() {
      platformio run -e "''${1:-wokwi_ulanzi}"
    }

    pio-clean() {
      platformio run -t clean -e "''${1:-wokwi_ulanzi}"
    }

    wokwi-install-cli() {
      mkdir -p "$WOKWI_HOME"
      WOKWI_CLI_INSTALL="$WOKWI_HOME" sh ./install.sh
    }

    wokwigw-install() {
      mkdir -p "$WOKWI_HOME/bin" "$WOKWI_HOME/tmp"

      local latest_url tag assets_page url zipfile
      zipfile="$WOKWI_HOME/tmp/wokwigw.zip"
      assets_page="$WOKWI_HOME/tmp/wokwigw-assets.html"

      latest_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/wokwi/wokwigw/releases/latest)
      tag=$(basename "$latest_url")
      if [ -z "$tag" ] || [ "$tag" = "latest" ]; then
        echo "Could not resolve latest wokwigw release tag"
        return 1
      fi

      curl -fL "https://github.com/wokwi/wokwigw/releases/expanded_assets/$tag" -o "$assets_page"
      url=$(grep -oE '/wokwi/wokwigw/releases/download/[^"'"']+/wokwigw_[^"'"']+_Linux_64bit\.zip' "$assets_page" | head -n 1)
      if [ -n "$url" ]; then
        url="https://github.com$url"
      fi

      if [ -z "$url" ]; then
        echo "Could not resolve Linux_64bit wokwigw asset from expanded_assets page"
        return 1
      fi

      curl -fL "$url" -o "$zipfile"
      unzip -o "$zipfile" -d "$WOKWI_HOME/tmp/wokwigw-unpack" >/dev/null

      local candidate
      candidate=$(find "$WOKWI_HOME/tmp/wokwigw-unpack" -maxdepth 1 -type f \( -name 'wokwigw' -o -name 'wokwigw-linux' \) | head -n 1)
      if [ -z "$candidate" ]; then
        echo "Could not locate extracted wokwigw binary"
        return 1
      fi

      install -m755 "$candidate" "$WOKWI_HOME/bin/wokwigw"
      echo "Installed wokwigw to $WOKWI_HOME/bin/wokwigw"
    }

    wokwigw-run() {
      if ! command -v wokwigw >/dev/null 2>&1; then
        echo "wokwigw not found. Run: wokwigw-install"
        return 127
      fi
      wokwigw "$@"
    }

    wokwigw-bridge() {
      if ! command -v wokwigw >/dev/null 2>&1; then
        echo "wokwigw not found. Run: wokwigw-install"
        return 127
      fi
      sudo wokwigw --bridge "$@"
    }

    wokwi-merge-bin() {
      esptool --chip esp32 merge-bin \
        -o .pio/build/wokwi_ulanzi/merged.bin \
        --flash-mode dio \
        --flash-size 4MB \
        0x1000 .pio/build/wokwi_ulanzi/bootloader.bin \
        0x8000 .pio/build/wokwi_ulanzi/partitions.bin \
        0x10000 .pio/build/wokwi_ulanzi/firmware.bin
    }

    wokwi-run() {
      if ! command -v wokwi-cli >/dev/null 2>&1; then
        echo "wokwi-cli not found. Run: wokwi-install-cli"
        return 127
      fi
      wokwi-cli "$@"
    }

    echo "AWTRIX3 Wokwi dev shell"
    echo "Commands:"
    echo "  codium .               Open the project in VSCodium"
    echo "  pio-build [env]        Build PlatformIO env, default: wokwi_ulanzi"
    echo "  pio-clean [env]        Clean PlatformIO env, default: wokwi_ulanzi"
    echo "  wokwi-install-cli      Install Wokwi CLI into .wokwi/bin"
    echo "  wokwigw-install        Install Wokwi Private IoT Gateway into .wokwi/bin"
    echo "  wokwigw-run [args]     Run Wokwi Private IoT Gateway"
    echo "  wokwigw-bridge [args]  Run Wokwi gateway in bridge mode (sudo required)"
    echo "  wokwi-merge-bin        Merge bootloader/partitions/app into merged.bin"
    echo "  wokwi-run ...          Run wokwi-cli with project-local PATH"
  '';
}
