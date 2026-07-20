-- Apple Music added as a distinct gift card brand (separate from the
-- generic 'apple' App Store brand) per business request.
ALTER TYPE gift_card_brand ADD VALUE IF NOT EXISTS 'apple_music';
