import random
from flask import Blueprint, request, jsonify, g
from models import get_db
from auth import login_required

points_bp = Blueprint('points', __name__)


@points_bp.route('/history', methods=['GET'])
@login_required
def get_history():
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT type, description, points, balance_after, created_at "
            "FROM points_log WHERE user_id = ? "
            "ORDER BY id DESC LIMIT ? OFFSET ?",
            (g.user_id, limit, offset)
        ).fetchall()
        logs = [dict(r) for r in rows]
        return jsonify({'logs': logs}), 200
    finally:
        conn.close()


@points_bp.route('/earn', methods=['POST'])
@login_required
def earn_points():
    data = request.get_json(silent=True) or {}
    pts = data.get('points', 0)
    if pts <= 0:
        pts = random.randint(1, 10)
    desc = data.get('description', '完成任务')

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT balance FROM users WHERE id = ?", (g.user_id,)
        ).fetchone()
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        new_balance = user['balance'] + pts
        conn.execute(
            "UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
            (new_balance, g.user_id)
        )
        conn.execute(
            "INSERT INTO points_log (user_id, type, description, points, balance_after) VALUES (?, 'earn', ?, ?, ?)",
            (g.user_id, desc, pts, new_balance)
        )
        conn.commit()
        return jsonify({'balance': new_balance, 'points_earned': pts}), 200
    finally:
        conn.close()


@points_bp.route('/leaderboard', methods=['GET'])
@login_required
def leaderboard():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name, balance as score FROM users ORDER BY balance DESC LIMIT 10"
        ).fetchall()

        leaderboard = []
        my_rank = None
        for i, r in enumerate(rows):
            entry = {
                'rank': i + 1,
                'name': r['name'],
                'score': r['score'],
                'is_me': r['id'] == g.user_id,
            }
            leaderboard.append(entry)
            if r['id'] == g.user_id:
                my_rank = i + 1

        # If current user not in top 10, find their rank
        if my_rank is None:
            user = conn.execute(
                "SELECT balance FROM users WHERE id = ?", (g.user_id,)
            ).fetchone()
            if user:
                rank_row = conn.execute(
                    "SELECT COUNT(*) as r FROM users WHERE balance > ?", (user['balance'],)
                ).fetchone()
                my_rank = rank_row['r'] + 1

        return jsonify({'leaderboard': leaderboard, 'my_rank': my_rank}), 200
    finally:
        conn.close()
