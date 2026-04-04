-- Improve catalog fallback query performance
CREATE INDEX "products_isActive_categoryId_idx" ON "products"("isActive", "categoryId");
CREATE INDEX "products_isActive_popularityScore_idx" ON "products"("isActive", "popularityScore" DESC);

CREATE INDEX "product_variants_productId_isActive_idx" ON "product_variants"("productId", "isActive");
CREATE INDEX "product_variants_isActive_size_price_idx" ON "product_variants"("isActive", "size", "price");

-- Support case-insensitive attribute filters (mode: insensitive)
CREATE INDEX "attributes_name_lower_idx" ON "attributes"(LOWER("name"));
CREATE INDEX "attribute_values_value_lower_idx" ON "attribute_values"(LOWER("value"));
