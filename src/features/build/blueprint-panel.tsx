import { CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

// Section order mirrors the product spec; progression, map, UI, thumbnail and gameplay loop lead.
const SECTIONS = [
  "Core gameplay loop", "Progression and reward structure", "Map plan and player flow", "UI screen inventory",
  "Thumbnail concepts", "Game title options and description", "Art direction", "Economy and balance assumptions",
  "Gamepasses and developer products", "Multiplayer and social mechanics", "Tutorial and first-session plan",
  "Retention and live-operations plan", "Asset inventory and naming rules", "Script architecture",
  "AI build prompts", "Map and UI reference images", "Testing checklist", "Community, Discord and social launch plan",
  "Milestones and next tasks",
];

export function BlueprintPanel({ approvedTitle }: { approvedTitle: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Blueprint" action={<Badge tone="positive">Concept approved</Badge>} />
        <p className="text-sm">
          <span className="font-medium">{approvedTitle}</span> is approved. The full blueprint, assets and script
          specifications are generated at production scale after the October beta, so these sections stay empty for now
          rather than showing filler.
        </p>
      </Card>
      <Card>
        <CardHeader title="Blueprint sections" />
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <li key={s} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <CircleDashed className="h-3.5 w-3.5 text-faint" aria-hidden />
              <span className={i < 5 ? "font-medium" : ""}>{s}</span>
              <span className="ml-auto text-[11px] text-faint">Not generated</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
