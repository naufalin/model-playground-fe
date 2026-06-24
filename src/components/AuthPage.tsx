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
    <main className="min-h-screen bg-[#F4EFE6] text-[#080B14]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        {/* ── Left: dark cinematic panel ─────────────────────────────── */}
        <section className="relative flex min-h-[44vh] flex-col justify-between overflow-hidden bg-[#080B14] px-6 py-8 text-white sm:px-10 lg:min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,242,193,0.22),transparent 28%),linear-gradient(135deg,rgba(8,11,20,0.85),rgba(8,11,20,0.98))]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_top,rgba(244,239,230,0.14),transparent)]" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-sm font-black text-[#080B14]">
                MP
              </div>
              <div>
                <p className="text-sm font-semibold">Model Playground</p>
                <p className="text-xs text-slate-400">Compare LLMs with focus</p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-300">
              Local lab
            </span>
          </div>

          <div className="relative z-10 max-w-2xl py-12 lg:py-0">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#5EF2C1]">
              Side-by-side model testing
            </p>
            <h1 className="max-w-xl text-[2.8rem] font-bold leading-[1.05] text-white sm:text-[3.5rem]">
              A calmer desk for sharper model decisions.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-400">
              Sign in to review available models, reopen recent playgrounds, and
              keep experiments organized before the chat workspace arrives.
            </p>
          </div>

          {/* Compact feature flow */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-slate-200">
                Model A
              </span>
              <span className="text-[#5EF2C1]">→</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-slate-200">
                Compare
              </span>
              <span className="text-[#5EF2C1]">→</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-slate-200">
                Model B
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Latency</span>
              <span className="text-white/20">·</span>
              <span>Cost</span>
              <span className="text-white/20">·</span>
              <span>Quality</span>
              <span className="text-white/20">·</span>
              <span>Reasoning</span>
            </div>
          </div>
        </section>

        {/* ── Right: sign-in card ────────────────────────────────────── */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md rounded-3xl border border-[#E3DACC] bg-[#FFFCF6] p-10 shadow-[0_24px_70px_rgba(8,11,20,0.08)]">
            <div className="mb-8">
              <p className="text-sm font-medium text-[#6B7280]">
                Welcome back
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#080B14]">
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
              <TabsList className="w-full rounded-xl border border-[#E3DACC] bg-[#F1EADF] p-[3px]">
                <TabsTrigger
                  value="login"
                  className="flex-1 rounded-lg text-sm data-active:bg-[#FFFCF6] data-active:text-[#080B14] data-active:shadow-sm"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="flex-1 rounded-lg text-sm data-active:bg-[#FFFCF6] data-active:text-[#080B14] data-active:shadow-sm"
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

            <p className="mt-6 text-center text-xs text-[#9CA3AF]">
              API: <span className="font-mono text-[#6B7280]">{API_BASE_URL}</span>
            </p>
          </div>
        </section>
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
          <span className="text-sm font-medium text-[#111827]">
            Display name
          </span>
          <Input
            className="mt-2 h-12 rounded-xl border-[#E3DACC] bg-white text-[#080B14] placeholder:text-[#9CA3AF] focus-visible:border-[#5EF2C1] focus-visible:ring-[#5EF2C1]/30"
            onChange={(event) => onUpdate('displayName', event.target.value)}
            placeholder="Ada Lovelace"
            type="text"
            value={form.displayName}
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-[#111827]">Email</span>
        <Input
          autoComplete="email"
          className="mt-2 h-12 rounded-xl border-[#E3DACC] bg-white text-[#080B14] placeholder:text-[#9CA3AF] focus-visible:border-[#5EF2C1] focus-visible:ring-[#5EF2C1]/30"
          onChange={(event) => onUpdate('email', event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#111827]">Password</span>
        <Input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="mt-2 h-12 rounded-xl border-[#E3DACC] bg-white text-[#080B14] placeholder:text-[#9CA3AF] focus-visible:border-[#5EF2C1] focus-visible:ring-[#5EF2C1]/30"
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
        className="h-[52px] w-full rounded-2xl bg-[#080B14] text-white shadow-[0_10px_30px_rgba(8,11,20,0.18)] transition-all duration-150 hover:bg-[#111827] hover:-translate-y-px"
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
