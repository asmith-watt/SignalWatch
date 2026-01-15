-- Add category column to sources table
ALTER TABLE sources ADD COLUMN IF NOT EXISTS category TEXT;

-- Update existing sources with appropriate categories based on their names/types
-- Regulatory sources
UPDATE sources SET category = 'regulatory' WHERE
  name ILIKE '%FDA%' OR
  name ILIKE '%USDA%' OR
  name ILIKE '%APHIS%' OR
  name ILIKE '%EPA%' OR
  name ILIKE '%FSIS%' OR
  name ILIKE '%federal%register%' OR
  name ILIKE '%department%agriculture%' OR
  source_type = 'regulator';

-- Trade associations
UPDATE sources SET category = 'trade_association' WHERE
  name ILIKE '%association%' OR
  name ILIKE '%council%' OR
  name ILIKE '%institute%' OR
  name ILIKE '%federation%' OR
  source_type = 'association';

-- Trade publications
UPDATE sources SET category = 'trade_publication' WHERE
  name ILIKE '%feed%grain%' OR
  name ILIKE '%feedstuffs%' OR
  name ILIKE '%world%grain%' OR
  name ILIKE '%agri%pulse%' OR
  name ILIKE '%meatingplace%' OR
  name ILIKE '%meat%poultry%' OR
  name ILIKE '%poultry%world%' OR
  name ILIKE '%dairy%herd%' OR
  name ILIKE '%beef%magazine%' OR
  name ILIKE '%pork%business%' OR
  name ILIKE '%reuters%' OR
  name ILIKE '%agweb%';

-- Company newsrooms (remaining sources)
UPDATE sources SET category = 'company' WHERE category IS NULL;
