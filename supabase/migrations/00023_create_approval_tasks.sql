CREATE TABLE IF NOT EXISTS public.approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_no text,
  module text NOT NULL,
  target_id text,
  target_no text,
  title text NOT NULL,
  submitter_id uuid REFERENCES public.profiles(id),
  submitter_name text,
  status text NOT NULL DEFAULT 'pending',
  result text,
  remark text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.approval_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许已认证用户查看审批任务" ON public.approval_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允许已认证用户更新审批任务" ON public.approval_tasks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
