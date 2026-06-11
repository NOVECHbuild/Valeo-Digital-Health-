import AccountSettingsPage from '@/components/AccountSettingsPage';
import PlatformSettings from '@/components/PlatformSettings';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PlatformSettings />
      <AccountSettingsPage role="admin" accent="#F7941D" accentLight="#C4700A" />
    </div>
  );
}
