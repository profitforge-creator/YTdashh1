import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DEFAULT_PREFS, SettingsForm, type Prefs } from "@/features/profile/settings-form";
import { requireViewer } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const stored = (viewer.prefs.notification_prefs ?? {}) as Partial<Prefs>;
  const prefs = { ...DEFAULT_PREFS, ...stored } as Prefs;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <Card>
        <SettingsForm initial={{ dm_policy: viewer.profile.dm_policy, preferred_ai: viewer.prefs.preferred_ai, prefs }} />
      </Card>
      <Card className="mt-4">
        <h2 className="text-sm font-medium">Roblox connection</h2>
        <p className="mt-1 text-sm text-muted">Roblox OAuth and automatic analytics sync arrive after the October beta. Until then, add metrics by hand or CSV in Analytics.</p>
      </Card>
    </div>
  );
}
