export function Footer() {
  const built = new Date().toISOString().slice(0, 10);
  const repo = process.env.NEXT_PUBLIC_REPO_URL;
  return (
    <footer className="mt-32 border-t border-hairline bg-paper-2">
      <div className="page grid gap-8 py-12 text-small md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-display text-2xl font-semibold text-ink">DMFQ-A</p>
          <p className="mt-2 text-stone">
            Aman Golani · Bhargav Mahanta · Kriday Narula
            <br />
            Operating Systems · Final Review
          </p>
        </div>
        <div className="md:col-span-4">
          <p className="kicker text-stone">Source</p>
          <p className="mt-2">Synthetic workloads; results from the DMFQ-A simulator. No real-hardware measurements.</p>
        </div>
        <div className="md:col-span-3">
          <p className="kicker text-stone">Build</p>
          <p className="mt-2">
            <span className="num">{built}</span>
            <br />
            {repo ? (
              <a className="link" href={repo} rel="noopener">
                Repository
              </a>
            ) : (
              <span className="text-stone">Repository link: set NEXT_PUBLIC_REPO_URL</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
