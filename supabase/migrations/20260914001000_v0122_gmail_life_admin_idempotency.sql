create unique index if not exists life_items_gmail_thread_unique_idx
  on public.life_items (user_id, (source_metadata->>'gmail_thread_id'))
  where source_metadata->>'source' = 'gmail'
    and nullif(source_metadata->>'gmail_thread_id','') is not null;

create unique index if not exists life_items_gmail_source_unique_idx
  on public.life_items (user_id, (source_metadata->>'source_record_id'))
  where source_metadata->>'source' = 'gmail'
    and nullif(source_metadata->>'source_record_id','') is not null;
