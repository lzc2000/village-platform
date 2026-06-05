from flask import Blueprint, request, jsonify, g
from models import get_db
from auth import hash_password, verify_password, create_token, login_required

auth_bp = Blueprint('auth', __name__)


def user_to_dict(row):
    """Convert a user DB row to a JSON-safe dict (exclude password_hash)."""
    return {
        'id': row['id'],
        'username': row['username'],
        'name': row['name'],
        'role': row['role'],
        'id_card': row['id_card'],
        'address': row['address'],
        'balance': row['balance'],
        'created_at': row['created_at'],
    }


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()
    role = data.get('role', 'villager')
    id_card = (data.get('id_card') or '').strip()
    address = (data.get('address') or '').strip()

    if not username or not password or not name:
        return jsonify({'error': '请填写用户名、密码和姓名'}), 400
    if role not in ('villager', 'official'):
        return jsonify({'error': '身份无效'}), 400
    if len(password) < 4:
        return jsonify({'error': '密码至少4位'}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            return jsonify({'error': '用户名已被占用'}), 409

        password_hash = hash_password(password)
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, name, role, id_card, address, balance) "
            "VALUES (?, ?, ?, ?, ?, ?, 150)",
            (username, password_hash, name, role, id_card, address)
        )
        conn.commit()
        user_id = cur.lastrowid

        # Insert initial points log
        conn.execute(
            "INSERT INTO points_log (user_id, type, description, points, balance_after) "
            "VALUES (?, 'earn', '初始积分', 150, 150)",
            (user_id,)
        )
        conn.commit()

        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        token = create_token(user_id, role)
        return jsonify({'token': token, 'user': user_to_dict(user)}), 201
    finally:
        conn.close()


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': '请填写用户名和密码'}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()

        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'error': '用户名或密码错误'}), 401

        token = create_token(user['id'], user['role'])
        return jsonify({'token': token, 'user': user_to_dict(user)}), 200
    finally:
        conn.close()


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_me():
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (g.user_id,)
        ).fetchone()
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        return jsonify({'user': user_to_dict(user)}), 200
    finally:
        conn.close()


@auth_bp.route('/me', methods=['PUT'])
@login_required
def update_me():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    id_card = (data.get('id_card') or '').strip()
    address = (data.get('address') or '').strip()

    if not name:
        return jsonify({'error': '姓名不能为空'}), 400

    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET name = ?, id_card = ?, address = ?, "
            "updated_at = datetime('now','localtime') WHERE id = ?",
            (name, id_card, address, g.user_id)
        )
        conn.commit()

        user = conn.execute("SELECT * FROM users WHERE id = ?", (g.user_id,)).fetchone()
        return jsonify({'user': user_to_dict(user)}), 200
    finally:
        conn.close()
