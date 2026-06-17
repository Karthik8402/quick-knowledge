import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, MailCheck, ShieldCheck, Zap } from 'lucide-react';
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

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 3D tilt for the form card
  const { ref: cardRef, style: cardStyle } = use3DTilt({ maxTilt: 6, scale: 1.02, perspective: 1200 });

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
          <Link to="/login">
            <Button variant="outline" size="sm" className="cursor-pointer">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-12">
        {/* ── Left panel ── */}
        <section className="hidden lg:block">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springEntrance }}
            className="max-w-md"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
              <KeyRound className="h-4 w-4" />
              Password recovery
            </div>
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight">
              Get back into your knowledge workspace.
            </h1>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Enter the email tied to your account. If it exists, we will send a secure reset link for creating a new password.
            </p>
            <div className="mt-8 space-y-3">
              {['Reset links are sent by email', 'Existing documents stay untouched', 'You can sign in again after updating'].map((item, i) => (
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

        {/* ── Right panel — 3D Glass Card with state morph ── */}
        <section className="flex items-center justify-center">
          <motion.div
            ref={cardRef}
            style={cardStyle}
            initial={{ opacity: 0, y: 24, rotateY: 8 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ ...springEntrance, delay: 0.1 }}
            className="w-full max-w-md"
          >
            <div className="glass-card glass-card-glow p-6 sm:p-7">
              {/* Header with icon transition */}
              <div className="mb-6 flex items-start justify-between gap-4">
                <div style={{ transform: 'translateZ(25px)' }}>
                  <h2 className="font-headline text-2xl font-bold tracking-tight">
                    {submitted ? 'Check your inbox' : 'Reset password'}
                  </h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {submitted ? 'We sent instructions if the account exists.' : 'Send a secure reset link to your email.'}
                  </p>
                </div>
                {/* Icon with crossfade transition */}
                <div
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"
                  style={{ transform: 'translateZ(40px)' }}
                >
                  <AnimatePresence mode="wait">
                    {submitted ? (
                      <motion.div
                        key="mail"
                        initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ ...springBounce }}
                      >
                        <MailCheck className="h-5 w-5 text-primary" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="key"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 180 }}
                        transition={{ ...springBounce }}
                        className="glow-ring-animated rounded-xl"
                      >
                        <KeyRound className="h-5 w-5 text-primary" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pulse rings on success */}
                  {submitted && (
                    <>
                      <span className="absolute inset-0 rounded-xl border border-primary/30 pulse-ring" />
                      <span className="absolute inset-0 rounded-xl border border-primary/20 pulse-ring" style={{ animationDelay: '0.2s' }} />
                      <span className="absolute inset-0 rounded-xl border border-primary/10 pulse-ring" style={{ animationDelay: '0.4s' }} />
                    </>
                  )}
                </div>
              </div>

              {/* Content — AnimatePresence for morph transition */}
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ ...springBounce }}
                    style={{ transform: 'translateZ(15px)' }}
                  >
                    <div className="rounded-xl border border-outline-variant/10 bg-background/30 p-4 text-sm leading-6 text-on-surface-variant backdrop-blur-sm">
                      If an account exists with <span className="font-semibold text-on-surface">{email}</span>, a password reset link will arrive shortly.
                    </div>
                    <div className="mt-6 flex flex-col gap-3">
                      <Link to="/login">
                        <Button className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]">
                          Back to sign in
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSubmitted(false)}
                        className="text-sm font-medium text-outline transition-colors duration-200 hover:text-on-surface cursor-pointer"
                      >
                        Use a different email
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ ...springBounce }}
                    onSubmit={handleSubmit}
                    className="space-y-4"
                    style={{ transform: 'translateZ(15px)' }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springBounce, delay: 0.15 }}
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
                      transition={{ ...springBounce, delay: 0.22 }}
                      style={{ transform: 'translateZ(30px)' }}
                    >
                      <Button
                        type="submit"
                        className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97]"
                        isLoading={loading}
                      >
                        Send reset link
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </motion.div>

                    <Link
                      to="/login"
                      className="flex items-center justify-center gap-2 text-sm font-medium text-outline transition-colors duration-200 hover:text-on-surface cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to sign in
                    </Link>
                  </motion.form>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="mt-6 rounded-xl border border-outline-variant/10 bg-background/30 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-outline">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Password changes happen through the secure auth session.
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
