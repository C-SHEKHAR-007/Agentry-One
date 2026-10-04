-- Per-token prices for a model (USD per million tokens). Optional: when
-- empty, a run falls back to the price the provider reported at discovery
-- (models.metadata.pricing), then to the flat per-job price.
ALTER TABLE "models" ADD COLUMN "input_price_per_mtok" DOUBLE PRECISION,
ADD COLUMN "output_price_per_mtok" DOUBLE PRECISION;
