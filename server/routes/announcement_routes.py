from flask import Blueprint, request, jsonify, g
from models import get_db
from auth import login_required, official_required

announcement_bp = Blueprint('announcements', __name__)


@announcement_bp.route('', methods=['GET'])
@login_required
def list_announcements():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT a.id, a.title, a.content, a.created_at,
                   u.name as publisher_name,
                   CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
            FROM announcements a
            JOIN users u ON a.publisher_id = u.id
            LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
            ORDER BY a.id DESC
        """, (g.user_id,)).fetchall()
        announcements = [dict(r) for r in rows]
        return jsonify({'announcements': announcements}), 200
    finally:
        conn.close()


@announcement_bp.route('', methods=['POST'])
@official_required
def create_announcement():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()

    if not title or not content:
        return jsonify({'error': '请填写标题和内容'}), 400

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO announcements (title, content, publisher_id) VALUES (?, ?, ?)",
            (title, content, g.user_id)
        )
        conn.commit()
        ann = conn.execute(
            "SELECT a.*, u.name as publisher_name FROM announcements a "
            "JOIN users u ON a.publisher_id = u.id WHERE a.id = ?",
            (cur.lastrowid,)
        ).fetchone()
        return jsonify({'announcement': dict(ann)}), 201
    finally:
        conn.close()


@announcement_bp.route('/<int:ann_id>/read', methods=['POST'])
@login_required
def mark_read(ann_id):
    conn = get_db()
    try:
        # Check announcement exists
        ann = conn.execute(
            "SELECT id, title FROM announcements WHERE id = ?", (ann_id,)
        ).fetchone()
        if not ann:
            return jsonify({'error': '公告不存在'}), 404

        # Try to insert read record; if already exists, UNIQUE constraint fails
        try:
            conn.execute(
                "INSERT INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)",
                (ann_id, g.user_id)
            )
            conn.commit()
        except Exception:
            return jsonify({'error': '已经阅读过该公告'}), 400

        # Award +1 point
        user = conn.execute(
            "SELECT balance FROM users WHERE id = ?", (g.user_id,)
        ).fetchone()
        new_balance = user['balance'] + 1
        conn.execute(
            "UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
            (new_balance, g.user_id)
        )
        conn.execute(
            "INSERT INTO points_log (user_id, type, description, points, balance_after) "
            "VALUES (?, 'earn', ?, 1, ?)",
            (g.user_id, f"阅读通知：{ann['title']}", new_balance)
        )
        conn.commit()
        return jsonify({'success': True, 'balance': new_balance, 'points_earned': 1}), 200
    finally:
        conn.close()
