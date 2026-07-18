-- Dedicated transaction type for VAS purchases (airtime/data/electricity)
-- rather than overloading 'fee', which means something different (a
-- platform fee charged on another transaction).
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'vas_purchase';
