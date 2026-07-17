#!/bin/sh
# 改完內容跑一次：同步升級 index.html 的 ?v=N 與 sw.js 快取版本
cd "$(dirname "$0")/.." || exit 1
cur=$(grep -o 'v=[0-9]*' index.html | head -1 | cut -d= -f2)
new=$((cur + 1))
sed -i '' "s/?v=$cur/?v=$new/g" index.html
sed -i '' "s/run-once-v$cur/run-once-v$new/" sw.js
echo "v$cur → v$new"
