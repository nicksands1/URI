import { GuidedSearchPage } from "@/components/GuidedSearch";
import { TXV_FIELDS } from "@/lib/domain/txv";

export default function TxvPage() {
  return (
    <GuidedSearchPage
      title="Guided TXV Search"
      description="Line size alone is never enough (CLAUDE.md §7) — connections and equalizer type are checked first."
      apiPath="/api/txv/query"
      fields={TXV_FIELDS}
      warningBanner="Refrigerant is NOT captured in this version — it's documented per model series in the catalog (e.g. R-404A vs R-22 families), not as a table column, and this is the single most important TXV selection driver. You must confirm refrigerant compatibility manually from the catalog page or nameplate before treating any candidate here as suitable."
    />
  );
}
