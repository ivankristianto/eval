export type PageShellOptions = {
  title: string;
  subtitle?: string;
  actions?: string;
  breadcrumbs?: string;
  content: string;
};

export const renderPageShell = (options: PageShellOptions): string => {
  const { title, subtitle, actions, breadcrumbs, content } = options;

  return `
    <div class="min-h-screen bg-base-100 text-base-content">
      <div class="navbar px-6 py-4 border-b border-base-200 bg-base-100/80 backdrop-blur">
        <div class="flex-1">
          <a class="font-display text-xl tracking-tight text-gold-accessible" href="/">
            Eval AI
          </a>
        </div>
        <div class="flex-none gap-4 text-sm text-base-content/70">
          <a class="hover:text-base-content" href="/">Evaluations</a>
          <a class="hover:text-base-content" href="/templates">Templates</a>
          <a class="hover:text-base-content" href="/personas">Personas</a>
          <a class="hover:text-base-content" href="/models">Models</a>
        </div>
      </div>
      <main class="container mx-auto px-4 py-8 max-w-7xl">
        ${
          breadcrumbs
            ? `<div class="breadcrumbs text-sm text-base-content/60 mb-6">
                <ul>${breadcrumbs}</ul>
              </div>`
            : ""
        }
        <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10">
          <div class="accent-line">
            <h1 class="text-4xl md:text-5xl font-display font-semibold tracking-tight mb-3 text-gradient-gold">
              ${title}
            </h1>
            ${subtitle ? `<p class="text-base-content/60 text-lg">${subtitle}</p>` : ""}
          </div>
          ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ""}
        </div>
        ${content}
      </main>
    </div>
  `;
};
