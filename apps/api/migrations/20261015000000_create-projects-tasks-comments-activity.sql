-- Up Migration

-- ============ PROJECTS ============
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description     text CHECK (length(description) <= 5000),
  created_by      uuid NOT NULL REFERENCES users(id),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

-- List an org's projects, newest first
CREATE INDEX projects_org_created_idx
  ON projects (organization_id, created_at DESC);

-- ============ TASKS ============
CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  project_id      uuid NOT NULL,
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description     text CHECK (length(description) <= 10000),
  status          text NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  priority        text NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date        date,
  assignee_id     uuid,
  created_by      uuid NOT NULL REFERENCES users(id),
  completed_at    timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),

  -- Task and project must be in the SAME org
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects (organization_id, id) ON DELETE CASCADE,

  -- Assignee must be a member of the SAME org.
  -- If the membership is removed, only assignee_id becomes NULL.
  FOREIGN KEY (organization_id, assignee_id)
    REFERENCES memberships (organization_id, user_id)
    ON DELETE SET NULL (assignee_id),

  -- 'done' if and only if completed_at is set
  CHECK ((status = 'done') = (completed_at IS NOT NULL))
);

-- Tasks in a project (the main list screen)
CREATE INDEX tasks_project_idx
  ON tasks (organization_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- "My tasks"
CREATE INDEX tasks_assignee_idx
  ON tasks (organization_id, assignee_id, due_date)
  WHERE deleted_at IS NULL;

-- ============ COMMENTS ============
CREATE TABLE comments (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  task_id         uuid NOT NULL,
  author_id       uuid NOT NULL REFERENCES users(id),
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Comment and task must be in the SAME org. Deleting the task deletes its comments.
  FOREIGN KEY (organization_id, task_id)
    REFERENCES tasks (organization_id, id) ON DELETE CASCADE
);

-- Show this task's comments, oldest first
CREATE INDEX comments_task_created_idx
  ON comments (organization_id, task_id, created_at ASC);

-- ============ ACTIVITY EVENTS ============
CREATE TABLE activity_events (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES users(id),          -- NULL = done by the system
  action          text NOT NULL,                      -- e.g. 'task.created', 'task.status_changed'
  entity_type     text NOT NULL
                  CHECK (entity_type IN ('organization', 'membership', 'project', 'task', 'comment')),
  entity_id       uuid NOT NULL,                      -- no FK on purpose: history outlives the entity
  project_id      uuid,                               -- lets us show a project's activity feed
  metadata        jsonb NOT NULL DEFAULT '{}',        -- e.g. {"from": "todo", "to": "done"}
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_entity_idx
  ON activity_events (organization_id, entity_type, entity_id, created_at DESC);

CREATE INDEX activity_project_idx
  ON activity_events (organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

-- Down Migration

DROP TABLE activity_events;
DROP TABLE comments;
DROP TABLE tasks;
DROP TABLE projects;