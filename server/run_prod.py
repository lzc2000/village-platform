"""
Production server entry point.
Uses Waitress (Windows-compatible WSGI) instead of Flask dev server.
Also serves the built frontend static files.

Usage:
    python run_prod.py
    JWT_SECRET=your-secret python run_prod.py --port 80
"""
import os
import sys
import argparse

# Ensure server/ is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import send_from_directory
from waitress import serve
from app import create_app


def main():
    parser = argparse.ArgumentParser(description="Village Platform Production Server")
    parser.add_argument("--port", type=int, default=5000, help="Listen port (default: 5000)")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default: 0.0.0.0)")
    args = parser.parse_args()

    # Security check
    jwt_secret = os.environ.get("JWT_SECRET")
    if not jwt_secret or jwt_secret == "dev-secret-change-me-in-production":
        print("=" * 60)
        print("[!] WARNING: Using default JWT_SECRET!")
        print("    Set environment variable: set JWT_SECRET=<random-string>")
        print("    Generate one: python -c \"import secrets; print(secrets.token_hex(32))\"")
        print("=" * 60)
        print()

    app = create_app()

    # --- Serve frontend static files ---
    client_dist = os.path.join(os.path.dirname(__file__), "..", "client", "dist")

    if os.path.isdir(client_dist):
        @app.route("/")
        def serve_index():
            return send_from_directory(client_dist, "index.html")

        @app.route("/assets/<path:filename>")
        def serve_assets(filename):
            return send_from_directory(os.path.join(client_dist, "assets"), filename)

        # SPA fallback: all non-API routes → index.html
        @app.route("/<path:path>")
        def serve_spa_fallback(path):
            file_path = os.path.join(client_dist, path)
            if os.path.isfile(file_path):
                return send_from_directory(client_dist, path)
            return send_from_directory(client_dist, "index.html")

        print(f"[OK] Frontend static files served from: {client_dist}")
    else:
        print(f"[!] Frontend dist/ not found at {client_dist}")
        print("    Run: cd client && npm run build")
        print("    Then restart this server.")

    print(f"[OK] Production server running on http://{args.host}:{args.port}")
    serve(app, host=args.host, port=args.port, threads=8)


if __name__ == "__main__":
    main()
