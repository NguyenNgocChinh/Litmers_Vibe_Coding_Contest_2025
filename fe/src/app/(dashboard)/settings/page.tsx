'use client';

import SettingsForm from '@/features/auth/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account settings and preferences.</p>
      </div>

      <SettingsForm />
    </div>
  );
}

