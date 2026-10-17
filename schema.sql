PRAGMA foreign_keys = ON;

-- New dedicated tables. Existing public-site tables are left untouched.
CREATE TABLE IF NOT EXISTS secure_astrologers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  experience TEXT DEFAULT '',
  speciality TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secure_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT DEFAULT '',
  description TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secure_blogs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  content TEXT NOT NULL,
  photo_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
