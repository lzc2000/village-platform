from flask import Blueprint, request, jsonify, g
from models import get_db
from auth import login_required

product_bp = Blueprint('products', __name__)


@product_bp.route('', methods=['GET'])
@login_required
def list_products():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name, emoji, points, stock FROM products ORDER BY id"
        ).fetchall()
        products = [dict(r) for r in rows]
        return jsonify({'products': products}), 200
    finally:
        conn.close()


@product_bp.route('/<int:product_id>/exchange', methods=['POST'])
@login_required
def exchange_product(product_id):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")

        # Lock and check product
        product = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        if not product:
            conn.execute("ROLLBACK")
            return jsonify({'error': '商品不存在'}), 404
        if product['stock'] <= 0:
            conn.execute("ROLLBACK")
            return jsonify({'error': '商品已兑完'}), 400

        # Lock and check user balance
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (g.user_id,)
        ).fetchone()
        if user['balance'] < product['points']:
            conn.execute("ROLLBACK")
            return jsonify({'error': '积分不足'}), 400

        # Perform exchange
        new_balance = user['balance'] - product['points']
        new_stock = product['stock'] - 1

        conn.execute(
            "UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
            (new_balance, g.user_id)
        )
        conn.execute(
            "UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?",
            (new_stock, product_id)
        )
        conn.execute(
            "INSERT INTO exchanges (user_id, product_id, product_name, product_emoji, points_spent) "
            "VALUES (?, ?, ?, ?, ?)",
            (g.user_id, product_id, product['name'], product['emoji'], product['points'])
        )
        conn.execute(
            "INSERT INTO points_log (user_id, type, description, points, balance_after) VALUES (?, 'spend', ?, ?, ?)",
            (g.user_id, f"兑换{product['name']}", product['points'], new_balance)
        )

        conn.commit()
        return jsonify({
            'success': True,
            'balance': new_balance,
            'product': {
                'id': product['id'],
                'name': product['name'],
                'emoji': product['emoji'],
                'points': product['points'],
                'stock': new_stock,
            }
        }), 200
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
