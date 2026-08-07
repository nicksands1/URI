import { GuidedSearchPage } from "@/components/GuidedSearch";
import { COMPRESSOR_FIELDS } from "@/lib/domain/compressor";

export default function CompressorPage() {
  return (
    <GuidedSearchPage
      title="Guided Compressor Search"
      description="Horsepower alone is never enough (CLAUDE.md §7) — voltage and phase are checked first, then capacity and connections."
      apiPath="/api/compressor/query"
      fields={COMPRESSOR_FIELDS}
      extraLabels={{
        dim_h_raw: "H (in)",
        dim_w_raw: "W (in)",
        dim_l_raw: "L (in)",
        weight_raw: "Weight (lbs)",
      }}
      warningBanner="Refrigerant and application (low/med/high temp) are NOT captured in this version — they're documented per model family/suffix in the catalog, not as a table column, and this tool will not guess. You must confirm refrigerant compatibility manually from the model suffix or nameplate before treating any candidate here as suitable."
    />
  );
}
