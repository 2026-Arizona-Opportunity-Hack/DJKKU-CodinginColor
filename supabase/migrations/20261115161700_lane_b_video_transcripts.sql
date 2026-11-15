-- Real video transcripts (lane B). /api/transcript fetches a YouTube video's own captions from
-- Supadata (free plan: 100 requests a month, no card) and keeps them here, so each video costs at
-- most one request ever. A video with no captions is remembered as 'unavailable' and retried after
-- a week. Only the Pages Function (service role) reads or writes this table; no client role can.
-- Captions are public video text, never student data.

create table public.video_transcripts (
  video_id text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  status text not null check (status in ('ok', 'unavailable')),
  lang text check (lang is null or char_length(lang) <= 12),
  -- [{start_ms, text}] in video order; empty when unavailable.
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  fetched_at timestamptz not null default now()
);

alter table public.video_transcripts enable row level security;
-- No policies: with RLS on and no grants, anon and authenticated cannot read or write it.
revoke all on public.video_transcripts from public, anon, authenticated;
