import NeighborhoodIllustration from './NeighborhoodIllustration.tsx'

export default function WelcomeSection() {
  return (
    <section aria-labelledby="welcome-heading" className="grid items-center gap-6 rounded-3xl bg-sage px-6 py-8 sm:px-10 lg:grid-cols-[1.3fr_1fr] lg:py-10">
      <div>
        <p className="mb-4 text-sm font-extrabold tracking-widest uppercase">Good finds. Great neighbors.</p>
        <h2 id="welcome-heading" className="max-w-xl text-4xl leading-tight sm:text-5xl">A little closer to home.</h2>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">Browse items from sellers in your community. Find something you’ll love, and give everyday treasures a new chapter.</p>
        <a href="#listings-heading" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-xl bg-leaf px-6 py-3 font-bold text-white no-underline hover:bg-ink">Explore local listings
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="M4 12h16m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <p className="mt-4 text-sm text-muted">Everyone’s welcome. No account needed to browse.</p>
      </div>
      <NeighborhoodIllustration />
    </section>
  )
}
