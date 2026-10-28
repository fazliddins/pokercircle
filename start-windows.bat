@echo off
chcp 65001 >nul
title PokerCircle - сервер покера
cd /d "%~dp0"
set "NODE=node"
where node >nul 2>nul && goto run
if exist "%~dp0node\node.exe" goto local
echo.
echo  Node.js не найден. Скачиваю портативную версию (около 30 МБ), подождите...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip' -OutFile '%~dp0node.zip'; Expand-Archive '%~dp0node.zip' '%~dp0nodetmp' -Force; Move-Item '%~dp0nodetmp\node-v22.11.0-win-x64' '%~dp0node'; Remove-Item '%~dp0node.zip','%~dp0nodetmp' -Recurse -Force"
if not exist "%~dp0node\node.exe" (
  echo  Не удалось скачать Node.js. Установите его вручную с https://nodejs.org и запустите этот файл снова.
  if /i not "%~1"=="silent" pause
  exit /b
)
:local
set "NODE=%~dp0node\node.exe"
:run
echo.
echo  Запускаю PokerCircle... Не закрывайте это окно, пока играете.
echo.
if /i not "%~1"=="silent" start "" cmd /c "timeout /t 3 >nul & start msedge http://localhost:3000 || start http://localhost:3000"
:loop
if /i "%~1"=="silent" ("%NODE%" server.js >> "%~dp0server.log" 2>&1) else ("%NODE%" server.js)
if errorlevel 3 if not errorlevel 4 goto already
echo  Сервер остановился. Перезапуск через 5 секунд...
timeout /t 5 >nul
goto loop
:already
if /i not "%~1"=="silent" (
  echo  Игра уже запущена в фоне. Открываю её в браузере...
  start msedge http://localhost:3000 || start http://localhost:3000
  timeout /t 3 >nul
)
exit /b
