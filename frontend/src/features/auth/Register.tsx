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
          <Link to="/login">
            <Button variant="outline" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-10">
        <section className="hidden flex-col justify-center lg:flex">
          <div className="max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
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
              {[
                { icon: Shield, text: 'Account-based document isolation' },
                { icon: Clock, text: 'Timezone-aware profile metadata' },
                { icon: CheckCircle2, text: 'Ready for Supabase authentication' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 text-sm text-on-surface-variant">
                  <Icon className="h-4 w-4 text-primary" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-2xl"
          >
            <div className="relative rounded-2xl border border-outline-variant/20 bg-surface-container p-5 shadow-2xl shadow-black/25 sm:p-6 lg:p-7">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-headline text-2xl font-bold tracking-tight">Create account</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Set up your profile for a new knowledge workspace.
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <Button type="submit" className="w-full gap-2" isLoading={loading}>
                  Create account
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-on-surface-variant">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-primary-fixed">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
