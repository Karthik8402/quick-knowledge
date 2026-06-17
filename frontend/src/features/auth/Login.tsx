import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, LockKeyhole, LogIn, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BRAND } from '../../config/branding';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { AnimatedBackground } from '../../components/ui/AnimatedBackground';
import { use3DTilt } from '../../hooks/use3DTilt';

/* ── Spring configs (from ui-ux-pro-max: damping:20, stiffness:90) ── */
const springEntrance = { type: 'spring' as const, damping: 20, stiffness: 90 };
const springBounce = { type: 'spring' as const, damping: 25, stiffness: 120 };

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 3D tilt for the login card
  const { ref: cardRef, style: cardStyle } = use3DTilt({ maxTilt: 6, scale: 1.02, perspective: 1200 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      toast.success('Successfully logged in!');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-on-surface">
      {/* Aurora animated background */}
      <AnimatedBackground variant="aurora" />

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
          <Link to="/register">
            <Button variant="outline" size="sm" className="cursor-pointer">Create account</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8 lg:py-12">
        {/* ── Left panel — Info section with spring entrances ── */}
        <section className="hidden flex-col justify-center lg:flex">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springEntrance }}
            className="max-w-md"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
              <LockKeyhole className="h-4 w-4" />
              Secure workspace access
            </div>
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight">
              Continue where your documents left off.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Sign in to manage uploads, inspect retrieved chunks, and ask grounded questions from the same dashboard.
            </p>
            <div className="mt-8 space-y-3">
              {['Owner-scoped document retrieval', 'Saved workspace settings', 'Usage and system visibility'].map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springBounce, delay: 0.15 + i * 0.06 }}
                  className="flex items-center gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low/40 p-3 text-sm text-on-surface-variant backdrop-blur-sm transition-all duration-200 hover:border-primary/15"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  {item}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Right panel — 3D Glass Login Card ── */}
        <section className="flex items-center justify-center">
          <motion.div
            ref={cardRef}
            style={cardStyle}
            initial={{ opacity: 0, y: 24, rotateY: -8, rotateX: 3 }}
            animate={{ opacity: 1, y: 0, rotateY: 0, rotateX: 0 }}
            transition={{ ...springEntrance, delay: 0.1 }}
            className="w-full max-w-md"
          >
            <div className="glass-card glass-card-glow p-6 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div style={{ transform: 'translateZ(25px)' }}>
                  <h2 className="font-headline text-2xl font-bold tracking-tight">Sign in</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Use your workspace email and password.
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 glow-ring-animated"
                  style={{ transform: 'translateZ(40px)' }}
                >
                  <LogIn className="h-5 w-5 text-primary" />
                </div>
              </div>

              {/* Form — at translateZ(15px) */}
              <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: 'translateZ(15px)' }}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.2 }}
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
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.25 }}
                  className="space-y-2"
                >
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-fixed cursor-pointer transition-colors duration-200">
                      Forgot password?
                    </Link>
                  </div>
                </motion.div>

                {/* Button — at translateZ(30px) */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springBounce, delay: 0.3 }}
                  style={{ transform: 'translateZ(30px)' }}
                >
                  <Button
                    type="submit"
                    className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
                    isLoading={loading}
                  >
                    Sign in
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <div className="mt-6 rounded-xl border border-outline-variant/10 bg-background/30 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-medium text-outline">
                    <FileText className="h-4 w-4 text-primary" />
                    Your documents and chat settings load after sign in.
                  </div>
                </div>

                <p className="mt-6 text-center text-sm text-on-surface-variant">
                  New to {BRAND.name}?{' '}
                  <Link to="/register" className="font-medium text-primary hover:text-primary-fixed cursor-pointer transition-colors duration-200">
                    Create an account
                  </Link>
                </p>
              </motion.div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
