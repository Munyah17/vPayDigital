-- =============================================================================
-- Retain KYC documents and IBAN request history when a profile is deleted
-- =============================================================================
-- kyc_documents.user_id and iban_accounts.user_id were ON DELETE CASCADE,
-- so deleting a profile (e.g. a user who registered but never transacted)
-- silently destroyed identity-verification evidence and IBAN request
-- history. Every financial table (wallets, wallet_transactions, cards,
-- payout_requests, ...) already correctly uses ON DELETE RESTRICT so the
-- delete is blocked instead — bring these two in line with that pattern for
-- AML/KYC retention purposes.

ALTER TABLE kyc_documents DROP CONSTRAINT kyc_documents_user_id_fkey;
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE iban_accounts DROP CONSTRAINT iban_accounts_user_id_fkey;
ALTER TABLE iban_accounts ADD CONSTRAINT iban_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
