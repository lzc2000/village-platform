@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   设置 Windows 自启动服务
echo ========================================
echo.

cd /d "%~dp0"

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  请以管理员身份运行此脚本！
    echo    右键 setup_service.bat → 以管理员身份运行
    pause
    exit /b 1
)

:: Download NSSM if not present
where nssm >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] 下载 NSSM (Non-Sucking Service Manager)...

    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip'" >nul 2>&1
    powershell -Command "Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TEMP%\nssm' -Force" >nul 2>&1

    :: Copy nssm.exe to System32
    copy /y "%TEMP%\nssm\nssm-2.24\win64\nssm.exe" "C:\Windows\System32\" >nul 2>&1

    if %errorlevel% neq 0 (
        echo ✗ NSSM 下载失败，请手动下载：
        echo   https://nssm.cc/download
        echo   将 nssm.exe 放到 C:\Windows\System32\
        pause
        exit /b 1
    )
    echo ✓ NSSM 安装完成
)

:: Stop and remove existing service if any
nssm stop VillagePlatform >nul 2>&1
nssm remove VillagePlatform confirm >nul 2>&1

:: Get Python path
for /f %%i in ('where python') do set PYTHON=%%i

:: Install the service
echo [*] 安装 VillagePlatform 服务...

nssm install VillagePlatform "%PYTHON%"
nssm set VillagePlatform AppDirectory "%~dp0server"
nssm set VillagePlatform AppParameters "run_prod.py --port 80"
nssm set VillagePlatform AppStdout "%~dp0logs\stdout.log"
nssm set VillagePlatform AppStderr "%~dp0logs\stderr.log"
nssm set VillagePlatform AppRotateFiles 1
nssm set VillagePlatform AppRotateOnline 1
nssm set VillagePlatform AppRotateSeconds 86400
nssm set VillagePlatform AppRotateBytes 1048576
nssm set VillagePlatform Start SERVICE_AUTO_START
nssm set VillagePlatform Description "乡村村务平台 - Village Affairs Platform"

:: Create logs directory
if not exist "logs" mkdir logs

echo ✓ 服务已安装

:: Start the service
echo [*] 启动服务...
nssm start VillagePlatform
if %errorlevel% equ 0 (
    echo ✓ 服务已启动
) else (
    echo ⚠️  服务启动失败，请检查日志
)

echo.
echo ========================================
echo   设置完成！
echo ========================================
echo.
echo 管理命令：
echo   nssm start VillagePlatform   启动
echo   nssm stop VillagePlatform    停止
echo   nssm restart VillagePlatform 重启
echo   nssm remove VillagePlatform  删除服务
echo   nssm edit VillagePlatform    编辑配置
echo.
echo 访问地址：http://你的服务器IP
echo.
pause
