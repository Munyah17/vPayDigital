-- The Super Admin dashboard's volume chart and network breakdown were
-- Math.random() mock data and a hardcoded percentage split — fake numbers
-- on a financial platform's own command center. These views back real
-- endpoints instead.

CREATE OR REPLACE VIEW vw_daily_volume_30d AS
SELECT
  d::date AS date,
  COALESCE(SUM(t.amount) FILTER (WHERE t.direction = 'credit' AND t.status = 'completed'), 0) AS volume,
  COALESCE(SUM(t.fee) FILTER (WHERE t.status = 'completed'), 0) AS fees,
  COUNT(c.id) AS cards_issued
FROM generate_series(
  (CURRENT_DATE - INTERVAL '29 days')::date,
  CURRENT_DATE::date,
  '1 day'
) AS d
LEFT JOIN wallet_transactions t ON t.created_at::date = d
LEFT JOIN cards c ON c.created_at::date = d
GROUP BY d
ORDER BY d;

CREATE OR REPLACE VIEW vw_cards_by_network AS
SELECT network, COUNT(*) AS count
FROM cards
WHERE status NOT IN ('terminated', 'expired')
GROUP BY network
ORDER BY count DESC;
