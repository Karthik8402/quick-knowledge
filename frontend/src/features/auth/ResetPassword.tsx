import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { AnimatedBackground } from '../../components/ui/AnimatedBackground';
import { use3DTilt } from '../../hooks/use3DTilt';

/* ── Spring configs (from ui-ux-pro-max) ── */
const springEntrance = { type: 'spring' as const, damping: 20, stiffness: 90 };
const springBounce = { type: 'spring' as const, damping: 25, stiffness: 120 };

export default function ResetPasswordPage() {
  const { updateUserPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);

  // 3D tilt for the card
  const { ref: cardRef, style: cardStyle } = use3DTilt({ maxTilt: 6, scale: 1.02, perspective: 1200 });

  // Supabase automatically captures the hash fragment when clicking an email link
  // and establishes a session. We just need to ensure the session exists.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error('Invalid or expired reset link. Please request a new one.');
        navigate('/forgot-password');
      } else {
        setValidatingSession(false);
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await updateUserPassword(password);
      toast.success('Password updated successfully!');
      // Sign out and redirect to login to force a clean re-login
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingSession) {
    return <div className="min-h-screen bg-background" />; // Empty while checking
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-on-surface">
      {/* Aurora animated background (matching other auth pages) */}
      <AnimatedBackground variant="aurora" />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>

      <motion.div
        ref={cardRef}
        style={cardStyle}
        initial={{ opacity: 0, y: 20, rotateX: 5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ ...springEntrance }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card glass-card-glow p-6 sm:p-7">
          {/* Header */}
          <div className="space-y-2 text-center pb-6" style={{ transform: 'translateZ(25px)' }}>
            <div className="flex justify-center mb-4">
              <div className="p-3.5 bg-green-500/10 rounded-2xl ring-1 ring-green-500/20 glow-ring-animated">
                <ShieldCheck className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface font-headline">Set new password</h2>
            <p className="text-sm text-on-surface-variant">
              Please enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ transform: 'translateZ(15px)' }}>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springBounce, delay: 0.15 }}
              >
                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springBounce, delay: 0.22 }}
              >
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springBounce, delay: 0.29 }}
              className="pt-5"
              style={{ transform: 'translateZ(30px)' }}
            >
              <Button
                type="submit"
                className="w-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
                isLoading={loading}
              >
                Update Password
              </Button>
            </motion.div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
