drop table if exists chunks cascade;
create extension if not exists vector;

create table chunks (
  id          bigserial primary key,
  doc_id      text not null,
  county      text not null,
  fiscal_year text not null,
  doc_type    text not null,
  page        int  not null,
  chunk_index int  not null,
  content     text not null,
  embedding   vector(768)
);

create index chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index chunks_county_idx on chunks (county);
create index chunks_fy_idx     on chunks (fiscal_year);

create or replace function match_chunks(
  query_embedding vector(768),
  match_count     int  default 8,
  filter_county   text default null,
  filter_fy       text default null
)
returns table (
  id bigint, doc_id text, county text, fiscal_year text,
  doc_type text, page int, content text, similarity float
)
language plpgsql as $$
begin
  return query
  select c.id, c.doc_id, c.county, c.fiscal_year, c.doc_type,
         c.page, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where (filter_county is null or c.county = filter_county)
    and (filter_fy     is null or c.fiscal_year = filter_fy)
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

alter table chunks enable row level security;
drop policy if exists "chunks are publicly readable" on chunks;
create policy "chunks are publicly readable"
  on chunks for select using (true);