import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  login,
  signup,
  getCurrentUser,
  API_BASE_URL,
} from '@/lib/api'
import type { User } from '@/lib/api'

type AuthMode = 'login' | 'signup'

type AuthForm = {
  email: string
  password: string
  displayName: string
}

export function AuthPage({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: User) => void
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [form, setForm] = useState<AuthForm>({
    email: '',
    password: '',
    displayName: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validationError = useMemo(() => {
    if (!form.email.trim()) {
      return 'Email is required.'
    }

    if (!form.email.includes('@')) {
      return 'Use a valid email address.'
    }

    if (!form.password) {
      return 'Password is required.'
    }

    if (mode === 'signup' && form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }

    return null
  }, [form.email, form.password, mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'signup') {
        await signup(form.email.trim(), form.password, form.displayName)
      }

      const tokenResponse = await login(form.email.trim(), form.password)
      const profile = await getCurrentUser(tokenResponse.access_token)
      onAuthenticated(tokenResponse.access_token, profile)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to authenticate right now.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateForm(field: keyof AuthForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <main className="glass-mesh-bg h-screen overflow-hidden bg-[#080B14] text-white">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3.5 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-xs font-black text-[#080B14]">
            MP
          </div>
          <span className="text-sm font-semibold text-white/80">
            Model Playground
          </span>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/40">
          Local lab
        </span>
      </header>

      {/* ── Centered content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex h-[calc(100vh-56px)] flex-col items-center justify-center px-6 sm:px-10">
        {/* Hero text */}
        <div className="mb-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#5EF2C1]">
            Side-by-side model testing
          </p>
          <h1 className="mx-auto max-w-xl text-[2rem] font-bold leading-[1.08] text-white sm:text-[2.6rem]">
            A calmer desk for sharper model decisions.
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-white/40">
            Compare LLMs side-by-side. Track latency, cost, quality, and
            reasoning.
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card w-full max-w-md rounded-3xl p-8">
          <div className="mb-6">
            <p className="text-sm font-medium text-white/50">
              Welcome back
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white">
              {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
            </h2>
          </div>

          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as AuthMode)
              setError(null)
            }}
          >
            <TabsList className="glass-tabs w-full rounded-xl p-[3px]">
              <TabsTrigger
                value="login"
                className="flex-1 rounded-lg text-sm text-white/60 data-active:bg-white/12 data-active:text-white data-active:shadow-sm"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="flex-1 rounded-lg text-sm text-white/60 data-active:bg-white/12 data-active:text-white data-active:shadow-sm"
              >
                Signup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <AuthForm
                form={form}
                mode="login"
                error={error}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onUpdate={updateForm}
              />
            </TabsContent>

            <TabsContent value="signup">
              <AuthForm
                form={form}
                mode="signup"
                error={error}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onUpdate={updateForm}
              />
            </TabsContent>
          </Tabs>

          <p className="mt-4 text-center text-xs text-white/25">
            API: <span className="font-mono text-white/35">{API_BASE_URL}</span>
          </p>
        </div>

        {/* Feature flow — compact, below card */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-white/35">
            <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-white/60">
              Model A
            </span>
            <span className="text-[#5EF2C1]">→</span>
            <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-white/60">
              Compare
            </span>
            <span className="text-[#5EF2C1]">→</span>
            <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-white/60">
              Model B
            </span>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/25">
            <span>Latency</span>
            <span className="text-white/15">·</span>
            <span>Cost</span>
            <span className="text-white/15">·</span>
            <span>Quality</span>
            <span className="text-white/15">·</span>
            <span>Reasoning</span>
          </div>
        </div>
      </div>
    </main>
  )
}

function AuthForm({
  form,
  mode,
  error,
  isSubmitting,
  onSubmit,
  onUpdate,
}: {
  form: AuthForm
  mode: AuthMode
  error: string | null
  isSubmitting: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUpdate: (field: keyof AuthForm, value: string) => void
}) {
  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      {mode === 'signup' ? (
        <label className="block">
          <span className="text-sm font-medium text-white/70">
            Display name
          </span>
          <Input
            className="glass-input mt-2 h-12 rounded-xl"
            onChange={(event) => onUpdate('displayName', event.target.value)}
            placeholder="Joko Wee"
            type="text"
            value={form.displayName}
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-white/70">Email</span>
        <Input
          autoComplete="email"
          className="glass-input mt-2 h-12 rounded-xl"
          onChange={(event) => onUpdate('email', event.target.value)}
          placeholder="hidup@jokowee.com"
          type="email"
          value={form.email}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white/70">Password</span>
        <Input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="glass-input mt-2 h-12 rounded-xl"
          onChange={(event) => onUpdate('password', event.target.value)}
          placeholder={
            mode === 'signup' ? 'At least 8 characters' : 'Your password'
          }
          type="password"
          value={form.password}
        />
      </label>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="h-[52px] w-full rounded-2xl bg-white/90 text-[#080B14] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-150 hover:bg-white hover:-translate-y-px"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting
          ? 'Working...'
          : mode === 'login'
            ? 'Sign in'
            : 'Create account'}
      </Button>
    </form>
  )
}
