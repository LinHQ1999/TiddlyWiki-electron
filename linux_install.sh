#!/bin/bash

set -e

appimage=$(find ./dist -maxdepth 1 -name '*.AppImage' -print -quit)

if [[ -z "$appimage" ]]; then
    if [[ ! -d "node_modules" ]]; then
        pnpm install
    fi
    pnpm dist
    appimage=$(find ./dist -maxdepth 1 -name '*.AppImage' -print -quit)
fi

dest=~/.local/share/applications/td.desktop

cat <<D > $dest
[Desktop Entry]
Name=Tiddly Desktop
Comment=Tiddlywiki for Desktop
Exec=$(realpath "$appimage")
Icon=$(realpath ./build/icon.png)
Terminal=false
Type=Application
Categories=Utility;Application;
Keywords=notes;text;editor;
StartupNotify=true
D

if desktop-file-validate $dest &> /dev/null;then
    echo '安装成功'
else
    echo '安装失败'
fi

unset dest

set +e
