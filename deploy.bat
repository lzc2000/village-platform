@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   乡村村务平台 - Windows 部署脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 1. Check Python
echo [1/4] 检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ 未找到 Python，请先安装 Python 3.10+
    echo   https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

:: 2. Install Python dependencies
echo [2/4] 安装 Python 依赖...
cd server
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ✗ Python 依赖安装失败
    pause
    exit /b 1
)
cd ..
echo.

:: 3. Check Node.js and build frontend
echo [3/4] 构建前端...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ 未找到 Node.js，请先安装 Node.js 18+
    echo   https://nodejs.org/
    pause
    exit /b 1
)
cd client
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo ✗ 前端构建失败
    pause
    exit /b 1
)
cd ..
echo ✓ 前端构建完成 → client\dist\
echo.

:: 4. Set JWT_SECRET if not set
echo [4/4] 配置环境...
if "%JWT_SECRET%"=="" (
    echo 生成 JWT_SECRET...
    for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set JWT_SECRET=%%i
    setx JWT_SECRET "!JWT_SECRET!" >nul
    echo ✓ JWT_SECRET 已生成并持久化
)
echo.

echo ========================================
echo   部署完成！
echo ========================================
echo.
echo 启动生产服务器：
echo   cd server ^&^& python run_prod.py --port 80
echo.
echo 或在前台运行（端口 5000）：
echo   cd server ^&^& python run_prod.py
echo.
echo 如需开机自启，请运行：
echo   setup_service.bat
echo.
pause
