-- Apply only once the Worker that posts through cortaku_post_score is live. From then on, the browser
-- can read the leaderboard but cannot write to it; every score goes through the Worker's replay check.

revoke insert on table public.cortaku_high_scores from anon, authenticated;
drop policy "Anyone can post a current score" on public.cortaku_high_scores;
