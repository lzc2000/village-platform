#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "========================================"
echo "  乡村村务平台 - 启动生产服务器"
echo "  http://localhost:8080"
echo "========================================"
echo ""

# Activate venv if exists
if [ -f "venv/bin/python" ]; then
    echo "[✓] 使用虚拟环境"
    PYTHON="venv/bin/python"
else
    echo "[!] 未找到虚拟环境，使用系统 Python"
    PYTHON="python3"
fi

# Check frontend build
if [ ! -f "client/dist/index.html" ]; then
    echo "[!] 前端未构建，正在构建..."
    cd client
    npm install
    npm run build
    cd ..
    if [ ! -f "client/dist/index.html" ]; then
        echo "[✗] 前端构建失败"
        exit 1
    fi
    echo "[✓] 前端构建完成"
fi

# Generate JWT_SECRET if not set
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "dev-secret-change-me-in-production" ]; then
    echo "[!] JWT_SECRET 未设置，正在生成..."
    export JWT_SECRET=$($PYTHON -c "import secrets; print(secrets.token_hex(32))")
    echo "export JWT_SECRET=$JWT_SECRET" >> ~/.bashrc
    echo "[✓] JWT_SECRET 已生成并写入 ~/.bashrc"
fi

echo ""
echo "启动服务器 http://0.0.0.0:8080"
echo "按 Ctrl+C 停止"
echo "========================================"
echo ""

$PYTHON server/run_prod.py --port 8080
