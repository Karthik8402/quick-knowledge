import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

function PublicNav() {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-outline-variant/20 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <span className="truncate font-headline text-lg font-bold tracking-tight text-on-surface sm:text-xl">
            {BRAND.name}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link to="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>
      <PublicNav />

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-20 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Retrieval-first answers for your files
            </div>

            <h1 className="max-w-3xl font-headline text-4xl font-bold leading-tight tracking-tight text-on-surface sm:text-5xl lg:text-6xl">
              Turn your documents into a fast, searchable knowledge workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
              Quick Knowledge helps you upload documents, retrieve the right chunks, and chat with answers that stay close to your sources.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={user ? '/dashboard' : '/register'} className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  {user ? 'Open dashboard' : 'Create workspace'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {!user && (
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-8 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
              {['Source-backed responses', 'Multi-provider LLMs', 'Secure user scope'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="min-w-0"
          >
            <div className="overflow-hidden rounded-lg border border-outline-variant/25 bg-surface-container-low shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-error" />
                  <div className="h-2.5 w-2.5 rounded-full bg-tertiary" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-medium uppercase tracking-widest text-outline">Knowledge Chat</span>
              </div>

              <div className="grid gap-0 md:grid-cols-[0.72fr_1fr]">
                <aside className="border-b border-outline-variant/20 bg-background p-4 md:border-b-0 md:border-r">
                  <div className="mb-4 flex items-center gap-2 rounded-md border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-outline">
                    <Search className="h-4 w-4" />
                    Search documents
                  </div>
                  <div className="space-y-2">
                    {['Karthik_K Resume.pdf', 'Project Notes.docx', 'Policy Handbook.pdf'].map((file, index) => (
                      <div
                        key={file}
                        className={`rounded-md border px-3 py-3 ${
                          index === 0
                            ? 'border-primary/25 bg-primary/10'
                            : 'border-outline-variant/15 bg-surface-container-low'
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

                <div className="space-y-4 p-4 sm:p-5">
                  <div className="rounded-lg border border-outline-variant/20 bg-background p-4">
                    <p className="text-sm font-medium text-on-surface">What skills are listed in this resume?</p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                      <Zap className="h-4 w-4" />
                      Answer
                    </div>
                    <p className="text-sm leading-6 text-on-surface-variant">
                      The resume highlights full-stack development, document processing, vector search, API design, and deployment workflows.
                    </p>
                    <div className="mt-4 rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-xs text-outline">
                      Source: Karthik_K Resume.pdf, Page 1
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="border-y border-outline-variant/20 bg-surface-container-lowest">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-4 sm:px-6 lg:px-8">
            {workflow.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-outline-variant/15 bg-background px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <span className="font-medium text-on-surface">{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Built for daily retrieval work</p>
            <h2 className="mt-3 font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              A cleaner way to ask questions across uploaded knowledge.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <LockKeyhole className="h-4 w-4" />
                Workspace ready
              </div>
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Start with your documents, not a blank chat.</h2>
            </div>
            <Link to={user ? '/dashboard' : '/register'} className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                {user ? 'Go to dashboard' : 'Get started'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/20 bg-surface-container-lowest px-4 py-6 text-center text-sm text-outline">
        &copy; {new Date().getFullYear()} {BRAND.name}. Built by {BRAND.author}.
      </footer>
    </div>
  );
}
