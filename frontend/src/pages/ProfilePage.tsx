import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../shared/Toast';
import { useUsageStore } from '../services/usage';
import { listDocuments } from '../api';
import type { DocumentMetadata } from '../types';

export default function ProfilePage() {
  const { user, updateUserPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const profileEmail = user?.email || 'Not available';
  const joinedDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : 'Unknown';
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || 'U';

  const { data: usageData, fetchUsageIfStale } = useUsageStore();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);

  useEffect(() => {
    fetchUsageIfStale();
    listDocuments().then(setDocuments).catch(() => setDocuments([]));
  }, [fetchUsageIfStale]);

  const totalChunks = documents.reduce((acc, doc) => acc + doc.chunks, 0);

  const calculateResetTime = (resetDate: string) => {
    const diffMs = new Date(resetDate).getTime() - Date.now();
    if (diffMs <= 0) return 'soon';
    const hours = Math.floor(diffMs / 3600_000);
    const minutes = Math.floor((diffMs % 3600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast('error', 'Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Mismatch', 'Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updateUserPassword(newPassword);
      showToast('success', 'Password Updated', 'Your password has been changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      showToast('error', 'Update Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl animate-fade-in-up">
      <div>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mb-2">Profile</h3>
        <p className="text-on-surface-variant text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl animate-scale-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary-container font-black text-2xl shadow-xl">
            {profileInitials}
          </div>
          <div>
            <h4 className="text-xl font-bold text-on-surface">{profileName}</h4>
            <p className="text-sm text-on-surface-variant">{profileEmail}</p>
            <p className="text-xs text-outline mt-1">Joined {joinedDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 block">Display Name</label>
            <input
              type="text"
              className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 transition-all duration-300"
              value={profileName}
              disabled
              title="Display name is managed via Supabase Auth"
            />
            <p className="text-[11px] text-outline mt-1">Managed via authentication provider.</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 block">Email</label>
            <input
              type="email"
              className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 transition-all duration-300"
              value={profileEmail}
              disabled
            />
          </div>
        </div>
      </div>

      {/* Account Usage Statistics */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl animate-scale-in" style={{ animationDelay: '0.15s' }}>
        <h4 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary/60">analytics</span>
          Account Usage Statistics
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-container-highest/50 p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1">AI Requests</p>
            <p className="text-xl font-bold text-on-surface">
              {usageData ? `${usageData.used} / ${usageData.limit}` : '...'}
            </p>
            {usageData && (
              <p className="text-[10px] text-on-surface-variant mt-1">Resets in: {calculateResetTime(usageData.reset_at)}</p>
            )}
          </div>
          <div className="bg-surface-container-highest/50 p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Plan</p>
            <p className="text-xl font-bold text-on-surface">
              {usageData ? usageData.plan : '...'}
            </p>
          </div>
          <div className="bg-surface-container-highest/50 p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Documents</p>
            <p className="text-xl font-bold text-on-surface">{documents.length}</p>
          </div>
          <div className="bg-surface-container-highest/50 p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Total Chunks</p>
            <p className="text-xl font-bold text-on-surface">{totalChunks}</p>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl animate-scale-in" style={{ animationDelay: '0.2s' }}>
        <h4 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary/60">lock</span>
          Change Password
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 block">New Password</label>
            <input
              type="password"
              className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 transition-all duration-300"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 block">Confirm Password</label>
            <input
              type="password"
              className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 transition-all duration-300"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={saving || !newPassword}
          className="bg-primary text-on-primary-fixed px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:shadow-[0_0_20px_rgba(181,196,255,0.3)] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span className={`material-symbols-outlined text-lg ${saving ? 'animate-spin' : ''}`}>
            {saving ? 'progress_activity' : 'save'}
          </span>
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      {/* Account Info */}
      <div className="bg-surface-container-low border border-outline-variant/10 p-4 sm:p-6 rounded-xl sm:rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary/60 text-lg mt-0.5 flex-shrink-0">info</span>
          <div className="text-xs text-on-surface-variant leading-relaxed space-y-1">
            <p><strong className="text-on-surface">Profile data</strong> is managed through Supabase Auth. Display name and avatar changes can be made via the Supabase dashboard.</p>
            <p>To update your email address, please contact the administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
