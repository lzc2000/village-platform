import hashlib
import os
import time
import jwt
from config import JWT_SECRET, JWT_EXPIRY_HOURS


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a random salt."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ':' + dk.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash."""
    salt_hex, dk_hex = stored_hash.split(':')
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return dk.hex() == dk_hex


def create_token(user_id: int, role: str) -> str:
    """Create a JWT token for the given user."""
    now = int(time.time())
    payload = {
        'user_id': user_id,
        'role': role,
        'iat': now,
        'exp': now + JWT_EXPIRY_HOURS * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Returns payload or raises."""
    return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])


# ---------- Flask decorators ----------

from functools import wraps
from flask import request, g, jsonify


def login_required(f):
    """Decorator: require valid JWT token in Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        try:
            payload = decode_token(auth[7:])
            g.user_id = payload['user_id']
            g.role = payload['role']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def official_required(f):
    """Decorator: require valid JWT + 'official' role."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if g.role != 'official':
            return jsonify({'error': '村干部权限要求'}), 403
        return f(*args, **kwargs)
    return decorated
