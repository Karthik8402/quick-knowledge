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

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-background text-on-surface">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>
      <header className="border-b border-outline-variant/20 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="truncate font-headline text-lg font-bold tracking-tight">{BRAND.name}</span>
          </Link>
          <Link to="/register">
            <Button variant="outline" size="sm">Create account</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8 lg:py-12">
        <section className="hidden flex-col justify-center lg:flex">
          <div className="max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <LockKeyhole className="h-4 w-4" />
              Secure workspace access
            </div>
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight">
              Continue where your documents left off.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Sign in to manage uploads, inspect retrieved chunks, and ask grounded questions from the same dashboard.
            </p>
            <div className="mt-8 space-y-4">
              {['Owner-scoped document retrieval', 'Saved workspace settings', 'Usage and system visibility'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <CheckCircle2 className="h-4 w-4 text-[#7dd3a8]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="relative rounded-2xl border border-outline-variant/20 bg-surface-container p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="mb-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                  <LogIn className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-headline text-2xl font-bold tracking-tight">Sign in</h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Use your workspace email and password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="space-y-2">
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
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-fixed">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" isLoading={loading}>
                  Sign in
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6 rounded-md border border-outline-variant/20 bg-background p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-outline">
                  <FileText className="h-4 w-4 text-primary" />
                  Your documents and chat settings load after sign in.
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-on-surface-variant">
                New to {BRAND.name}?{' '}
                <Link to="/register" className="font-medium text-primary hover:text-primary-fixed">
                  Create an account
                </Link>
              </p>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
