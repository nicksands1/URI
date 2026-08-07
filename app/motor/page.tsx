import { GuidedSearchPage } from "@/components/GuidedSearch";
import { MOTOR_FIELDS } from "@/lib/domain/motor";

export default function MotorPage() {
  return (
    <GuidedSearchPage
      title="Guided Motor Search"
      description="Answers the field that eliminates the most candidates first — not a fixed checklist. HP + RPM alone is never enough (CLAUDE.md §7)."
      apiPath="/api/motor/query"
      fields={MOTOR_FIELDS}
      extraLabels={{ amps_raw: "Amps", weight_raw: "Weight (lbs)" }}
    />
  );
}
