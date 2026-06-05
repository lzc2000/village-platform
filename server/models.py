import sqlite3
from config import DB_PATH

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    UNIQUE NOT NULL,
    password_hash   TEXT    NOT NULL,
    name            TEXT    NOT NULL,
    role            TEXT    NOT NULL DEFAULT 'villager',
    id_card         TEXT    DEFAULT '',
    address         TEXT    DEFAULT '',
    balance         INTEGER NOT NULL DEFAULT 150,
    created_at      TEXT    DEFAULT (datetime('now','localtime')),
    updated_at      TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    emoji       TEXT    DEFAULT '',
    points      INTEGER NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS exchanges (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    product_id    INTEGER NOT NULL,
    product_name  TEXT    NOT NULL,
    product_emoji TEXT    DEFAULT '',
    points_spent  INTEGER NOT NULL,
    created_at    TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS points_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    type          TEXT    NOT NULL CHECK(type IN ('earn','spend')),
    description   TEXT    NOT NULL,
    points        INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at    TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL,
    publisher_id INTEGER NOT NULL,
    created_at   TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (publisher_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcement_reads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    read_at         TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (announcement_id) REFERENCES announcements(id),
    FOREIGN KEY (user_id)         REFERENCES users(id),
    UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exchanges_user ON exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_points_log_user  ON points_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ann_reads_user   ON announcement_reads(user_id);
"""


def get_db():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database tables if they don't exist."""
    conn = get_db()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def seed_if_empty():
    """Insert seed data if the products table is empty."""
    conn = get_db()
    try:
        cur = conn.execute("SELECT COUNT(*) FROM products")
        count = cur.fetchone()[0]
        if count == 0:
            _seed_data(conn)
            conn.commit()
    finally:
        conn.close()


def _seed_data(conn):
    """Insert default products, demo users, and sample announcements."""
    # Default products (8 items)
    products = [
        ('洗衣粉', '🧺', 30, 20),
        ('抽纸（3包装）', '🧻', 15, 50),
        ('食用油（1.8L）', '🫙', 200, 10),
        ('大米（5kg）', '🌾', 150, 15),
        ('香皂（2块装）', '🧼', 10, 100),
        ('文具套装', '✏️', 50, 30),
        ('洗洁精', '🫧', 25, 40),
        ('毛巾', '🧣', 20, 35),
    ]
    conn.executemany(
        "INSERT INTO products (name, emoji, points, stock) VALUES (?, ?, ?, ?)",
        products
    )

    # Demo users (password is "123456" for all)
    from auth import hash_password
    demo_password = hash_password("123456")
    users = [
        ('admin', demo_password, '张主任', 'official', '110101198001011234', '青山村委会'),
        ('zhang', demo_password, '张大叔', 'villager', '110101199001011234', '青山村3组'),
        ('lisi', demo_password, '李婶婶', 'villager', '110101199202020022', '青山村5组'),
        ('wangwu', demo_password, '王阿姨', 'villager', '110101198503030033', '青山村2组'),
    ]
    conn.executemany(
        "INSERT INTO users (username, password_hash, name, role, id_card, address) VALUES (?, ?, ?, ?, ?, ?)",
        users
    )

    # Sample announcements
    announcements = [
        ('村委会议通知', '本周五下午2点召开村民议事会，欢迎全体村民参与！', 1),
        ('积分规则调整', '即日起，报告问题积分由5分调整为10分（严重问题可获得额外加分）。', 1),
        ('上月积分榜公示', '恭喜前三名获得积分奖励！下月再接再厉~', 1),
        ('庭院评比启动', '本月启动"最美庭院"评比活动，获评者可获得50积分奖励！', 1),
    ]
    conn.executemany(
        "INSERT INTO announcements (title, content, publisher_id) VALUES (?, ?, ?)",
        announcements
    )
