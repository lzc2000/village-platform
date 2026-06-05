from flask import Blueprint, request, jsonify, g
from models import get_db
from auth import official_required

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/stats', methods=['GET'])
@official_required
def stats():
    conn = get_db()
    try:
        total_users = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
        total_exchanges = conn.execute("SELECT COUNT(*) as c FROM exchanges").fetchone()['c']
        total_points = conn.execute(
            "SELECT COALESCE(SUM(points), 0) as s FROM points_log WHERE type = 'earn'"
        ).fetchone()['s']
        return jsonify({
            'total_users': total_users,
            'total_exchanges': total_exchanges,
            'total_points_issued': total_points,
        }), 200
    finally:
        conn.close()


@admin_bp.route('/users', methods=['GET'])
@official_required
def list_users():
    q = request.args.get('q', '', type=str).strip()
    conn = get_db()
    try:
        if q:
            rows = conn.execute(
                "SELECT id, username, name, role, balance, id_card, address, created_at "
                "FROM users WHERE name LIKE ? OR username LIKE ? ORDER BY id",
                (f'%{q}%', f'%{q}%')
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, username, name, role, balance, id_card, address, created_at "
                "FROM users ORDER BY id"
            ).fetchall()
        users = [dict(r) for r in rows]
        return jsonify({'users': users}), 200
    finally:
        conn.close()


@admin_bp.route('/users/<int:user_id>/balance', methods=['PUT'])
@official_required
def adjust_balance(user_id):
    data = request.get_json(silent=True) or {}
    delta = data.get('delta', 0)
    reason = (data.get('reason') or '').strip()

    if delta == 0:
        return jsonify({'error': '调整金额不能为0'}), 400
    if not reason:
        return jsonify({'error': '请填写调整原因'}), 400

    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        new_balance = user['balance'] + delta
        if new_balance < 0:
            return jsonify({'error': '积分不能为负数'}), 400

        conn.execute(
            "UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
            (new_balance, user_id)
        )
        log_type = 'earn' if delta > 0 else 'spend'
        conn.execute(
            "INSERT INTO points_log (user_id, type, description, points, balance_after) VALUES (?, ?, ?, ?, ?)",
            (user_id, log_type, reason, abs(delta), new_balance)
        )
        conn.commit()

        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return jsonify({'user': {
            'id': user['id'], 'name': user['name'], 'username': user['username'],
            'role': user['role'], 'balance': user['balance'],
        }}), 200
    finally:
        conn.close()


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@official_required
def update_product(product_id):
    data = request.get_json(silent=True) or {}

    conn = get_db()
    try:
        product = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        if not product:
            return jsonify({'error': '商品不存在'}), 404

        name = data.get('name', product['name'])
        points = data.get('points', product['points'])
        stock = data.get('stock', product['stock'])

        conn.execute(
            "UPDATE products SET name = ?, points = ?, stock = ?, "
            "updated_at = datetime('now','localtime') WHERE id = ?",
            (name, points, stock, product_id)
        )
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        return jsonify({'product': dict(updated)}), 200
    finally:
        conn.close()


@admin_bp.route('/announcements/<int:ann_id>', methods=['DELETE'])
@official_required
def delete_announcement(ann_id):
    conn = get_db()
    try:
        ann = conn.execute(
            "SELECT id FROM announcements WHERE id = ?", (ann_id,)
        ).fetchone()
        if not ann:
            return jsonify({'error': '公告不存在'}), 404

        conn.execute("DELETE FROM announcement_reads WHERE announcement_id = ?", (ann_id,))
        conn.execute("DELETE FROM announcements WHERE id = ?", (ann_id,))
        conn.commit()
        return jsonify({'success': True}), 200
    finally:
        conn.close()
