import sys
import os

# Ensure server/ directory is on the Python path for local imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from config import DB_PATH
from models import init_db, seed_if_empty
from routes.auth_routes import auth_bp
from routes.product_routes import product_bp
from routes.points_routes import points_bp
from routes.announcement_routes import announcement_bp
from routes.admin_routes import admin_bp


def create_app():
    app = Flask(__name__)
    app.config['JSON_AS_ASCII'] = False  # Support Chinese characters

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(product_bp, url_prefix='/api/products')
    app.register_blueprint(points_bp, url_prefix='/api/points')
    app.register_blueprint(announcement_bp, url_prefix='/api/announcements')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # Initialize database on first request
    with app.app_context():
        init_db()
        seed_if_empty()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
