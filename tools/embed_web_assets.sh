#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo "usage: embed_web_assets.sh <awtrix3-dir>" >&2
  exit 1
fi
A3="$(cd "$1" && pwd)"
HTML="$A3/www/app.html"
CSS="$A3/www/app.css"
JS="$A3/www/app.js"
OUT="$A3/src/web_assets.h"
tmp_html="$(mktemp)"
tmp_gz="$(mktemp)"
trap 'rm -f "$tmp_html" "$tmp_gz"' EXIT
# Inline JS directly (already readable format), minify CSS on the fly
perl -0pe '
  BEGIN {
    local $/;
    open my $js_fh, "<", $ARGV[1] or die "open js: $!";
    $js = <$js_fh>;
    close $js_fh;
    shift @ARGV;
    open my $css_fh, "<", $ARGV[0] or die "open css: $!";
    my $css = <$css_fh>;
    close $css_fh;
    shift @ARGV;
    # Minify CSS
    $css =~ s!/\*.*?\*/!!gs;
    $css =~ s!\s+! !g;
    $css =~ s! ?([{};,:]) !$1!g;
  }
  s|<link rel="stylesheet" href="/www/app\.css">|<style>$css</style>|;
  s|<script src="/www/app\.js"></script>|<script>$js</script>|;
' "$CSS" "$JS" "$HTML" > "$tmp_html"
gzip -n -9 -c "$tmp_html" > "$tmp_gz"
{
  printf '#pragma once\n#include <Arduino.h>\n\n'
  printf 'static const char app_html_content_type[] PROGMEM = "text/html; charset=utf-8";\n'
  printf 'static const uint8_t app_html_gz[] PROGMEM = {\n'
  od -An -tx1 -v "$tmp_gz" | while read -r line; do
    [ -z "$line" ] && continue
    printf '  '
    for byte in $line; do printf '0x%s, ' "$byte"; done
    printf '\n'
  done
  printf '};\n'
  printf 'static const size_t app_html_gz_len = sizeof(app_html_gz);\n'
} > "$OUT"
printf '  web_assets.h (%s bytes)\n' "$(wc -c < "$tmp_gz")"
