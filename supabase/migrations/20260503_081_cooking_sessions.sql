CREATE TABLE cooking_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id            uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup              jsonb NOT NULL,
  plan               jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'briefing'
                       CHECK (status IN ('briefing','prep','cooking','complete')),
  current_step_index integer NOT NULL DEFAULT 0,
  step_actuals       jsonb NOT NULL DEFAULT '[]',
  version            integer NOT NULL DEFAULT 1,  -- optimistic lock for multi-device
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cooking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cooking_sessions_select" ON cooking_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cooking_sessions_insert" ON cooking_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cooking_sessions_update" ON cooking_sessions
  FOR UPDATE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE cooking_sessions;
