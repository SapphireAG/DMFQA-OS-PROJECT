import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section className="page py-32 text-center">
      <p className="kicker text-stone">Error 404</p>
      <h1 className="mx-auto mt-6 max-w-3xl text-[48px] leading-tight md:text-h1">This page was never scheduled.</h1>
      <p className="mx-auto mt-6 max-w-xl text-ink-2">
        It waited in Q2 so long that even aging could not bring it back. Try one of the pages that did run.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <ButtonLink href="/">Overview</ButtonLink>
        <ButtonLink href="/llm/">LLM Serving Live</ButtonLink>
      </div>
    </section>
  );
}
