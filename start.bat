@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ========================================
echo   乡村村务平台 - 启动生产服务器
echo   http://localhost:8080
echo ========================================
echo.

:: Activate venv if exists
if exist "venv\Scripts\python.exe" (
    echo [✓] 使用虚拟环境
    set PYTHON=venv\Scripts\python.exe
) else (
    echo [!] 未找到虚拟环境，使用系统 Python
    set PYTHON=python
)

:: Check frontend build
if not exist "client\dist\index.html" (
    echo [!] 前端未构建，正在构建...
    cd client
    call npm install
    call npm run build
    cd ..
    if not exist "client\dist\index.html" (
        echo [✗] 前端构建失败
        pause
        exit /b 1
    )
    echo [✓] 前端构建完成
)

:: Generate JWT_SECRET if not set
if "%JWT_SECRET%"=="" (
    echo [!] JWT_SECRET 未设置，正在生成...
    for /f %%i in ('%PYTHON% -c "import secrets; print(secrets.token_hex(32))"') do set JWT_SECRET=%%i
    setx JWT_SECRET "%JWT_SECRET%" >nul
    echo [✓] JWT_SECRET 已生成
)

echo.
echo 启动服务器 http://0.0.0.0:8080
echo 按 Ctrl+C 停止
echo ========================================
echo.

%PYTHON% server\run_prod.py --port 8080
pause
