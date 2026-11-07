@echo off
rem Double-click to play: no server, nothing to keep open. See tools/play.mjs.
cd /d "%~dp0"
node tools\play.mjs
if errorlevel 1 pause
