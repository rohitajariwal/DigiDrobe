-- ============================================================
-- DigiDrobe3D relational schema
-- Target: PostgreSQL 13+
-- Note: enable the pgcrypto extension for gen_random_uuid()
--       (CREATE EXTENSION IF NOT EXISTS pgcrypto;)
-- ============================================================

CREATE TABLE users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    full_name      VARCHAR(255),
    measurements   JSONB DEFAULT '{}'::jsonb,
    preferences    JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wardrobe_items (
    item_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    category       VARCHAR(64) DEFAULT 'Uncategorized',
    color          VARCHAR(48),
    fabric         VARCHAR(48),
    size_label     VARCHAR(32),
    image_url      TEXT NOT NULL,
    thumb_url      TEXT,
    bg_removed     BOOLEAN NOT NULL DEFAULT FALSE,
    source_type    VARCHAR(16) NOT NULL DEFAULT 'upload', -- upload | capture | import
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mannequin_states (
    state_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    active_item_id UUID REFERENCES wardrobe_items(item_id) ON DELETE SET NULL,
    pose           JSONB DEFAULT '{}'::jsonb,
    camera         JSONB DEFAULT '{}'::jsonb,
    lighting       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE try_on_sessions (
    session_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mannequin_state_id UUID REFERENCES mannequin_states(state_id) ON DELETE SET NULL,
    items              JSONB NOT NULL, -- ordered list of wardrobe item ids
    notes              TEXT,
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at           TIMESTAMPTZ
);

CREATE TABLE outfits (
    outfit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title         VARCHAR(255),
    description   TEXT,
    items         JSONB NOT NULL, -- { "tops": [...], "bottoms": [...], ... }
    thumbnail_url TEXT,
    shared        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX idx_wardrobe_items_user ON wardrobe_items(user_id);
CREATE INDEX idx_wardrobe_items_category ON wardrobe_items(category);
CREATE INDEX idx_try_on_sessions_user ON try_on_sessions(user_id);
CREATE INDEX idx_outfits_user ON outfits(user_id);

