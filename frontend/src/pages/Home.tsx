import { Link, Navigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { BRAND } from '../config/branding';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { AnimatedBackground } from '../components/ui/AnimatedBackground';
import { use3DTilt } from '../hooks/use3DTilt';
import { useRef, memo } from 'react';

/* ────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────── */

const featureCards = [
  {
    icon: Database,
    title: 'Document Memory',
    copy: 'Upload PDFs and docs, then keep searchable chunks tied back to their original files.',
  },
  {
    icon: MessageSquareText,
    title: 'Grounded Chat',
    copy: 'Ask natural questions and get answers shaped by the documents in your workspace.',
  },
  {
    icon: Shield,
    title: 'Private Workspace',
    copy: 'Authentication, owner-scoped retrieval, and API guardrails keep each workspace separated.',
  },
];

const workflow = ['Upload', 'Index', 'Retrieve', 'Answer'];

/* ────────────────────────────────────────────────
   SPRING CONFIGS (from ui-ux-pro-max skill)
   ──────────────────────────────────────────────── */

const springEntrance = { type: 'spring' as const, damping: 20, stiffness: 90 };
const springBounce = { type: 'spring' as const, damping: 25, stiffness: 120 };

/* ────────────────────────────────────────────────
   NAV
   ──────────────────────────────────────────────── */

function PublicNav() {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-outline-variant/10 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3 cursor-pointer">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 glow-ring">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <span className="truncate font-headline text-lg font-bold tracking-tight text-on-surface sm:text-xl">
            {BRAND.name}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link to="/dashboard">
              <Button size="sm" className="cursor-pointer">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="cursor-pointer px-2 sm:px-3">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="cursor-pointer">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ────────────────────────────────────────────────
   FEATURE CARD with 3D depth
   ──────────────────────────────────────────────── */

const FeatureCard3D = memo(function FeatureCard3D({ icon: Icon, title, copy, index }: {
  icon: typeof Database;
  title: string;
  copy: string;
  index: number;
}) {
  const { ref, style } = use3DTilt({ maxTilt: 8, scale: 1.03, perspective: 1000 });

  return (
    <motion.div
      ref={ref}
      style={style}
      initial={{ opacity: 0, rotateX: 15, y: 30 }}
      whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ ...springBounce, delay: index * 0.1 }}
      className="glass-card glass-card-glow p-6 cursor-pointer"
    >
      <div style={{ transform: 'translateZ(30px)' }}>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 glow-ring">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
      <div style={{ transform: 'translateZ(15px)' }}>
        <h3 className="font-headline text-lg font-semibold text-on-surface">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{copy}</p>
      </div>
    </motion.div>
  );
});

/* ────────────────────────────────────────────────
   INTERACTIVE DEMO PREVIEW with 3D tilt
   ──────────────────────────────────────────────── */

const DemoPreview = memo(function DemoPreview() {
  const { ref, style } = use3DTilt({ maxTilt: 5, scale: 1.01, perspective: 1200 });

  return (
    <motion.div
      ref={ref}
      style={style}
      initial={{ opacity: 0, y: 30, rotateY: -8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ ...springEntrance, delay: 0.2 }}
      className="min-w-0"
    >
      <div className="glass-card glass-card-glow overflow-hidden shadow-2xl shadow-black/20">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest/60 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-error" />
            <div className="h-2.5 w-2.5 rounded-full bg-tertiary" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-medium uppercase tracking-widest text-outline">Knowledge Chat</span>
        </div>

        <div className="grid gap-0 md:grid-cols-[0.72fr_1fr]">
          {/* Sidebar — depth layer 1 */}
          <aside
            className="border-b border-outline-variant/10 bg-background/50 p-4 backdrop-blur-sm md:border-b-0 md:border-r"
            style={{ transform: 'translateZ(10px)' }}
          >
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface/30 px-3 py-2 text-sm text-outline backdrop-blur-sm">
              <Search className="h-4 w-4" />
              Search documents
            </div>
            <div className="space-y-2">
              {['Karthik_K Resume.pdf', 'Project Notes.docx', 'Policy Handbook.pdf'].map((file, index) => (
                <div
                  key={file}
                  className={`rounded-lg border px-3 py-3 transition-all duration-200 ${
                    index === 0
                      ? 'border-primary/25 bg-primary/10 glow-ring'
                      : 'border-outline-variant/10 bg-surface-container-low/40 hover:border-primary/15'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <p className="truncate text-sm font-medium text-on-surface">{file}</p>
                  </div>
                  <p className="mt-1 text-xs text-outline">{index === 0 ? '12 chunks indexed' : 'Ready for retrieval'}</p>
                </div>
              ))}
            </div>
          </aside>

          {/* Chat content — depth layer 2 */}
          <div className="space-y-4 p-4 sm:p-5" style={{ transform: 'translateZ(20px)' }}>
            <div className="rounded-lg border border-outline-variant/10 bg-background/40 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-on-surface">What skills are listed in this resume?</p>
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                <Zap className="h-4 w-4" />
                Answer
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">
                The resume highlights full-stack development, document processing, vector search, API design, and deployment workflows.
              </p>
              <div className="mt-4 rounded-lg border border-outline-variant/10 bg-surface-container-lowest/40 px-3 py-2 text-xs text-outline backdrop-blur-sm">
                Source: Karthik_K Resume.pdf, Page 1
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ────────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────────── */

export default function HomePage() {
  const { user, loading } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });

  // Parallax: hero text shifts slower than scroll
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.6]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div ref={scrollRef} className="min-h-screen text-on-surface">
      {/* Ambient background — particles variant for hero */}
      <AnimatedBackground variant="particles" />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>
      <PublicNav />

      <main>
        {/* ═══ SECTION 1: Full-screen Interactive Hero ═══ */}
        <section className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-24">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="flex flex-col justify-center perspective-1200"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0 }}
            >
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                Retrieval-first answers for your files
              </div>
            </motion.div>

            {/* Animated gradient headline — at translateZ(40px) for parallax depth */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.05 }}
              className="gradient-text max-w-3xl font-headline text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-4xl xl:text-5xl 2xl:text-6xl"
              style={{ transform: 'translateZ(40px)' }}
            >
              Turn your documents into a fast, searchable knowledge workspace.
            </motion.h1>

            {/* Subheading — at translateZ(20px) for lesser parallax shift */}
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.1 }}
              className="mt-5 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg"
              style={{ transform: 'translateZ(20px)' }}
            >
              Quick Knowledge helps you upload documents, retrieve the right chunks, and chat with answers that stay close to your sources.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.15 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link to={user ? '/dashboard' : '/register'} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97] sm:w-auto"
                >
                  {user ? 'Open dashboard' : 'Create workspace'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {!user && (
                <Link to="/login" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97] sm:w-auto"
                  >
                    Sign in
                  </Button>
                </Link>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.2 }}
              className="mt-8 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3"
            >
              {['Source-backed responses', 'Multi-provider LLMs', 'Secure user scope'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Interactive demo with 3D tilt */}
          <DemoPreview />
        </section>

        {/* ═══ SECTION 2: Workflow Pipeline — 3D step cards ═══ */}
        <section className="border-y border-outline-variant/10 bg-surface-container-lowest/50 backdrop-blur-sm">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-4 sm:px-6 lg:px-8">
            {workflow.map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, rotateY: 30, x: -20 }}
                whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...springBounce, delay: index * 0.08 }}
                className="perspective-1000"
              >
                <div className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-background/60 px-4 py-4 backdrop-blur-sm transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary glow-ring">
                    {index + 1}
                  </span>
                  <span className="font-medium text-on-surface">{step}</span>
                  {index < workflow.length - 1 && (
                    <ArrowRight className="ml-auto hidden h-4 w-4 text-outline/40 sm:block" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ SECTION 3: Feature Cards with 3D depth ═══ */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...springEntrance }}
            className="mb-10 max-w-2xl"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Built for daily retrieval work</p>
            <h2 className="mt-3 font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              A cleaner way to ask questions across uploaded knowledge.
            </h2>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map(({ icon, title, copy }, index) => (
              <FeatureCard3D key={title} icon={icon} title={title} copy={copy} index={index} />
            ))}
          </div>
        </section>

        {/* ═══ SECTION 4: CTA — Glassmorphism ═══ */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...springBounce }}
            className="glass-card glass-card-glow grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
          >
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                <LockKeyhole className="h-4 w-4" />
                Workspace ready
              </div>
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Start with your documents, not a blank chat.</h2>
            </div>
            <Link to={user ? '/dashboard' : '/register'} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97] sm:w-auto"
              >
                {user ? 'Go to dashboard' : 'Get started'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/10 bg-surface-container-lowest/40 px-4 py-6 text-center text-sm text-outline backdrop-blur-sm">
        &copy; {new Date().getFullYear()} {BRAND.name}. Built by {BRAND.author}.
      </footer>
    </div>
  );
}
