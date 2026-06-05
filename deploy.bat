@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   乡村村务平台 - Windows 部署脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 1. Check Python
echo [1/5] 检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ 未找到 Python，请先安装 Python 3.10+
    echo   https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

:: 2. Create virtual environment
echo [2/5] 创建 Python 虚拟环境...
if not exist "venv\Scripts\python.exe" (
    python -m venv venv
    echo ✓ 虚拟环境创建完成
) else (
    echo ✓ 虚拟环境已存在，跳过
)
echo.

:: 3. Install Python dependencies (inside venv)
echo [3/5] 安装 Python 依赖...
call venv\Scripts\activate.bat
pip install -r server\requirements.txt
if %errorlevel% neq 0 (
    echo ✗ Python 依赖安装失败
    pause
    exit /b 1
)
echo ✓ Python 依赖安装完成
echo.

:: 4. Check Node.js and build frontend
echo [4/5] 构建前端...
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

:: 5. Set JWT_SECRET if not set
echo [5/5] 配置环境...
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
echo 启动生产服务器（使用虚拟环境）：
echo   venv\Scripts\python server\run_prod.py --port 80
echo.
echo 或前台运行：
echo   venv\Scripts\python server\run_prod.py
echo.
echo 如需开机自启，请运行：
echo   setup_service.bat
echo.
pause
