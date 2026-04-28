alter table problems
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;

update problems
set photo_urls = jsonb_build_array(photo_url)
where photo_url is not null
  and photo_url <> ''
  and photo_urls = '[]'::jsonb;
