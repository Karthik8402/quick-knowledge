import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, Shield, UserPlus, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BRAND } from '../../config/branding';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { AnimatedBackground } from '../../components/ui/AnimatedBackground';
import { use3DTilt } from '../../hooks/use3DTilt';

/* ── Spring configs (from ui-ux-pro-max) ── */
const springEntrance = { type: 'spring' as const, damping: 20, stiffness: 90 };
const springBounce = { type: 'spring' as const, damping: 25, stiffness: 120 };

export default function RegisterPage() {
  const { signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 3D tilt for the register card
  const { ref: cardRef, style: cardStyle } = use3DTilt({ maxTilt: 5, scale: 1.01, perspective: 1200 });

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
      await signUpWithEmail(email, password, {
        full_name: fullName,
        phone,
        timezone,
      });
      toast.success('Account created! Please check your email to verify your account.', { duration: 6000 });
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign up.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, text: 'Account-based document isolation' },
    { icon: Clock, text: 'Timezone-aware profile metadata' },
    { icon: CheckCircle2, text: 'Ready for Supabase authentication' },
  ];

  return (
    <div className="min-h-screen text-on-surface">
      {/* Mesh gradient animated background (differentiated from Login aurora) */}
      <AnimatedBackground variant="mesh" />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>

      <header className="relative z-10 border-b border-outline-variant/10 bg-background/50 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 cursor-pointer">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 glow-ring">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="truncate font-headline text-lg font-bold tracking-tight">{BRAND.name}</span>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm" className="cursor-pointer">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-10">
        {/* ── Left panel — Feature bullets with 3D flip entrance ── */}
        <section className="hidden flex-col justify-center lg:flex">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springEntrance }}
            className="max-w-md"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
              <UserPlus className="h-4 w-4" />
              New workspace setup
            </div>
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight">
              Create a place for answers that cite your files.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Add your profile details once, then move into document upload, retrieval, and chat workflows.
            </p>
            <div className="mt-8 grid gap-3">
              {features.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, rotateX: 60 }}
                  animate={{ opacity: 1, rotateX: 0 }}
                  transition={{ ...springBounce, delay: 0.15 + i * 0.08 }}
                  className="perspective-1000"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low/40 p-3.5 text-sm text-on-surface-variant backdrop-blur-sm transition-all duration-200 hover:border-primary/15 hover:bg-surface-container-low/60 cursor-pointer">
                    <Icon className="h-4 w-4 text-primary" />
                    {text}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Right panel — 3D Glass Register Card ── */}
        <section className="flex items-center justify-center">
          <motion.div
            ref={cardRef}
            style={cardStyle}
            initial={{ opacity: 0, y: 24, rotateY: 8 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ ...springEntrance, delay: 0.1 }}
            className="w-full max-w-2xl"
          >
            <div className="glass-card glass-card-glow p-6 sm:p-7 lg:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div style={{ transform: 'translateZ(25px)' }}>
                  <h2 className="font-headline text-2xl font-bold tracking-tight">Create account</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Set up your profile for a new knowledge workspace.
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 glow-ring-animated"
                  style={{ transform: 'translateZ(40px)' }}
                >
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: 'translateZ(15px)' }}>
                {/* Row 1: Name + Phone */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.15 }}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <Input
                    label="Full name"
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    disabled={loading}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+1 555 0144"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    disabled={loading}
                  />
                </motion.div>

                {/* Row 2: Email + Timezone */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.22 }}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <Input
                    label="Email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                  <Input
                    label="Timezone"
                    type="text"
                    placeholder="Asia/Kolkata"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                    autoComplete="off"
                    disabled={loading}
                  />
                </motion.div>

                {/* Row 3: Passwords */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.29 }}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <Input
                    label="Confirm password"
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </motion.div>

                {/* Submit button */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.36 }}
                  style={{ transform: 'translateZ(30px)' }}
                >
                  <Button
                    type="submit"
                    className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
                    isLoading={loading}
                  >
                    Create account
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </form>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.3 }}
                className="mt-6 text-center text-sm text-on-surface-variant"
              >
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-primary-fixed cursor-pointer transition-colors duration-200">
                  Sign in
                </Link>
              </motion.p>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
