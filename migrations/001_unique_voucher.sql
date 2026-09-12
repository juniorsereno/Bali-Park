-- Audit first; no existing sale is deleted or merged.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE bali_park.vendas IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bali_park.vendas
    WHERE NULLIF(BTRIM(voucher_code), '') IS NOT NULL
    GROUP BY UPPER(BTRIM(voucher_code)) HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existing duplicate vouchers: review them before applying this migration.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_voucher_unique
  ON bali_park.vendas (UPPER(BTRIM(voucher_code)))
  WHERE NULLIF(BTRIM(voucher_code), '') IS NOT NULL;
COMMIT;
