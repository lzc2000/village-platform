import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'village.db')
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me-in-production')
JWT_EXPIRY_HOURS = 168  # 7 days
