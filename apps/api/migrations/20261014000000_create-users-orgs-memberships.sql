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

-- YOUR TURN: memberships table goes here
CREATE TABLE memberships (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id           uuid NOT NULL REFERENCES users(id),
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  role              text NOT NULL CHECK (role IN ('admin', 'member')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- Down Migration

-- YOUR TURN: drop the tables in the correct order
DROP TABLE memberships;
DROP TABLE organizations;
DROP TABLE users;