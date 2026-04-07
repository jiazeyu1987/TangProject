-- AI 医院导入过程管理系统 MVP
-- PostgreSQL schema

create extension if not exists pgcrypto;

begin;

create table if not exists regions (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null unique,
    code varchar(50),
    status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    region_id uuid references regions(id),
    name varchar(100) not null,
    email varchar(255),
    phone varchar(50),
    role varchar(30) not null check (
        role in (
            'field_staff',
            'channel_staff',
            'regional_manager',
            'sales_director',
            'general_manager',
            'admin'
        )
    ),
    status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_users_region_id on users(region_id);
create index if not exists idx_users_role on users(role);

create table if not exists hospitals (
    id uuid primary key default gen_random_uuid(),
    region_id uuid not null references regions(id),
    name varchar(255) not null,
    alias_name varchar(255),
    hospital_level varchar(50),
    province varchar(100),
    city varchar(100),
    address text,
    status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (region_id, name)
);

create index if not exists idx_hospitals_region_id on hospitals(region_id);
create index if not exists idx_hospitals_name on hospitals(name);

create table if not exists departments (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid not null references hospitals(id) on delete cascade,
    name varchar(150) not null,
    status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_id, name)
);

create index if not exists idx_departments_hospital_id on departments(hospital_id);

create table if not exists project_stages (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    name varchar(100) not null unique,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists issue_tags (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    name varchar(100) not null unique,
    category varchar(50),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists hospital_projects (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid not null references hospitals(id),
    region_id uuid not null references regions(id),
    owner_user_id uuid references users(id),
    current_stage_id uuid references project_stages(id),
    project_status varchar(20) not null default 'active' check (
        project_status in ('active', 'paused', 'completed', 'archived')
    ),
    risk_level varchar(20) not null default 'normal' check (
        risk_level in ('low', 'normal', 'high', 'critical')
    ),
    manager_attention_needed boolean not null default false,
    last_follow_up_at timestamptz,
    next_action text,
    next_action_due_at timestamptz,
    latest_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hospital_id)
);

create index if not exists idx_hospital_projects_region_id on hospital_projects(region_id);
create index if not exists idx_hospital_projects_owner_user_id on hospital_projects(owner_user_id);
create index if not exists idx_hospital_projects_current_stage_id on hospital_projects(current_stage_id);
create index if not exists idx_hospital_projects_status on hospital_projects(project_status);
create index if not exists idx_hospital_projects_attention on hospital_projects(manager_attention_needed);

create table if not exists hospital_contacts (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid not null references hospitals(id) on delete cascade,
    department_id uuid references departments(id) on delete set null,
    name varchar(100) not null,
    role_title varchar(100),
    phone varchar(50),
    email varchar(255),
    influence_level varchar(20) check (influence_level in ('low', 'medium', 'high', 'key')),
    attitude varchar(20) check (attitude in ('positive', 'neutral', 'negative', 'unknown')),
    notes text,
    last_contact_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_hospital_contacts_hospital_id on hospital_contacts(hospital_id);
create index if not exists idx_hospital_contacts_department_id on hospital_contacts(department_id);

create table if not exists conversation_sessions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references hospital_projects(id) on delete set null,
    user_id uuid not null references users(id),
    channel varchar(20) not null default 'web' check (channel in ('web', 'wecom', 'dingtalk', 'manual')),
    ai_session_id varchar(255),
    session_status varchar(20) not null default 'open' check (session_status in ('open', 'closed', 'archived')),
    started_at timestamptz not null default now(),
    ended_at timestamptz
);

create index if not exists idx_conversation_sessions_project_id on conversation_sessions(project_id);
create index if not exists idx_conversation_sessions_user_id on conversation_sessions(user_id);
create index if not exists idx_conversation_sessions_started_at on conversation_sessions(started_at desc);

create table if not exists conversation_messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references conversation_sessions(id) on delete cascade,
    sender_type varchar(20) not null check (sender_type in ('user', 'assistant', 'system')),
    message_type varchar(20) not null default 'text' check (message_type in ('text', 'summary', 'structured_json')),
    content text not null,
    token_count integer,
    created_at timestamptz not null default now()
);

create index if not exists idx_conversation_messages_session_id on conversation_messages(session_id);
create index if not exists idx_conversation_messages_created_at on conversation_messages(created_at);

create table if not exists project_updates (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references hospital_projects(id) on delete cascade,
    session_id uuid references conversation_sessions(id) on delete set null,
    created_by uuid not null references users(id),
    visit_date date,
    department_id uuid references departments(id) on delete set null,
    contact_summary text,
    feedback_summary text not null,
    blockers text,
    opportunities text,
    next_step text,
    stage_before_id uuid references project_stages(id),
    stage_after_id uuid references project_stages(id),
    manager_attention_needed boolean not null default false,
    extracted_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_project_updates_project_id on project_updates(project_id);
create index if not exists idx_project_updates_session_id on project_updates(session_id);
create index if not exists idx_project_updates_created_by on project_updates(created_by);
create index if not exists idx_project_updates_created_at on project_updates(created_at desc);
create index if not exists idx_project_updates_extracted_json on project_updates using gin (extracted_json);

create table if not exists update_contacts (
    id uuid primary key default gen_random_uuid(),
    update_id uuid not null references project_updates(id) on delete cascade,
    contact_id uuid references hospital_contacts(id) on delete set null,
    contact_name varchar(100) not null,
    contact_role varchar(100),
    created_at timestamptz not null default now()
);

create index if not exists idx_update_contacts_update_id on update_contacts(update_id);

create table if not exists project_issue_links (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references hospital_projects(id) on delete cascade,
    update_id uuid references project_updates(id) on delete cascade,
    issue_tag_id uuid not null references issue_tags(id),
    created_at timestamptz not null default now()
);

create index if not exists idx_project_issue_links_project_id on project_issue_links(project_id);
create index if not exists idx_project_issue_links_update_id on project_issue_links(update_id);
create index if not exists idx_project_issue_links_issue_tag_id on project_issue_links(issue_tag_id);

create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references hospital_projects(id) on delete cascade,
    update_id uuid references project_updates(id) on delete set null,
    source_session_id uuid references conversation_sessions(id) on delete set null,
    title varchar(255) not null,
    description text,
    assignee_user_id uuid references users(id),
    created_by uuid references users(id),
    priority varchar(20) not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    task_status varchar(20) not null default 'todo' check (task_status in ('todo', 'in_progress', 'done', 'overdue', 'cancelled')),
    due_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_project_id on tasks(project_id);
create index if not exists idx_tasks_assignee_user_id on tasks(assignee_user_id);
create index if not exists idx_tasks_status on tasks(task_status);
create index if not exists idx_tasks_due_at on tasks(due_at);

insert into project_stages (code, name, sort_order)
values
    ('initial_contact', '初步接触', 10),
    ('department_entry', '科室进入', 20),
    ('trial_use', '试用推进', 30),
    ('training', '培训实施', 40),
    ('routine_use', '常规使用', 50)
on conflict (code) do nothing;

insert into issue_tags (code, name, category)
values
    ('pricing', '收费', 'commercial'),
    ('training', '培训', 'implementation'),
    ('workflow', '流程', 'implementation'),
    ('clinical_value', '临床价值', 'clinical'),
    ('coordination', '人员协同', 'organization')
on conflict (code) do nothing;

commit;
