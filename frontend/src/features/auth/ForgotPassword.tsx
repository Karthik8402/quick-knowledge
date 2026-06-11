import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, MailCheck, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BRAND } from '../../config/branding';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await resetPasswordForEmail(email);
      setSubmitted(true);
      toast.success('Password reset link sent to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset link.');
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

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-12">
        <section className="hidden lg:block">
          <div className="max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <KeyRound className="h-4 w-4" />
              Password recovery
            </div>
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight">
              Get back into your knowledge workspace.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Enter the email tied to your account. If it exists, we will send a secure reset link for creating a new password.
            </p>
            <div className="mt-8 space-y-4">
              {['Reset links are sent by email', 'Existing documents stay untouched', 'You can sign in again after updating'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <CheckCircle2 className="h-4 w-4 text-[#7dd3a8]" />
                  {item}
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
            className="w-full max-w-md"
          >
            <div className="relative rounded-2xl border border-outline-variant/20 bg-surface-container p-5 shadow-2xl shadow-black/25 sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-headline text-2xl font-bold tracking-tight">
                    {submitted ? 'Check your inbox' : 'Reset password'}
                  </h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {submitted ? 'We sent instructions if the account exists.' : 'Send a secure reset link to your email.'}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                  {submitted ? <MailCheck className="h-5 w-5 text-primary" /> : <KeyRound className="h-5 w-5 text-primary" />}
                </div>
              </div>

              {submitted ? (
                <div>
                  <div className="rounded-md border border-outline-variant/20 bg-background p-4 text-sm leading-6 text-on-surface-variant">
                    If an account exists with <span className="font-semibold text-on-surface">{email}</span>, a password reset link will arrive shortly.
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <Link to="/login">
                      <Button className="w-full gap-2">
                        Back to sign in
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="text-sm font-medium text-outline transition-colors hover:text-on-surface"
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              ) : (
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

                  <Button type="submit" className="w-full gap-2" isLoading={loading}>
                    Send reset link
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>

                  <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-outline transition-colors hover:text-on-surface">
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </form>
              )}

              <div className="mt-6 rounded-md border border-outline-variant/20 bg-background p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-outline">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Password changes happen through the secure auth session.
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
