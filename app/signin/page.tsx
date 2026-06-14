import SignInForm from "./SignInForm";

export const metadata = { title: "Sign in — Goal Machine" };

export default function SignInPage() {
  return (
    <section className="min-h-screen bg-[#f2f2f7] px-4 py-10 font-sans text-slate-950 sm:px-6">
      <div className="mx-auto max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-black/5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#e8912e]">Goal Machine</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your email. We&rsquo;ll send a magic link &mdash; no password.
        </p>
        <div className="mt-6">
          <SignInForm />
        </div>
      </div>
    </section>
  );
}
