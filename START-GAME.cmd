@echo off
cd /d "%~dp0"
echo Hero Defense 3D - Independent
echo Open http://127.0.0.1:8767/ in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
python -m http.server 8767 --bind 127.0.0.1 --directory "%~dp0."
pause
