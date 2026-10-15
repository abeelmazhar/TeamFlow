-- Up Migration

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  email             text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash     text NOT NULL,
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- The primary key starts with organization_id, so lookups by user need their own index.
CREATE INDEX memberships_user_id_idx ON memberships (user_id);

-- At most one owner row per organization. Other roles are not limited by this index.
CREATE UNIQUE INDEX memberships_one_owner_per_org_idx
  ON memberships (organization_id)
  WHERE role = 'owner';

-- Down Migration

DROP TABLE memberships;
DROP TABLE organizations;
DROP TABLE users;