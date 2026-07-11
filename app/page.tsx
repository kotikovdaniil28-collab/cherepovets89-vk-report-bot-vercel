import { CardsGallery } from "@/components/cards-gallery"
import { CommandList } from "@/components/command-list"

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-10">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            v51 · black russia cards
          </p>
          <h1 className="text-balance text-3xl font-bold sm:text-4xl">
            CHEREPOVETS — VK бот
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Бот модерации сообщества Black Russia: отчёты, наказания, заявки,
            нейросеть Grok и фирменные арт-карточки, которые прикрепляются к
            командам прямо в VK.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="mb-2 text-xl font-semibold">Карточки команд</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Эти изображения бот прикрепляет к ответам: /help, /панель,
          приветствие новичков и разделы справки.
        </p>
        <CardsGallery />
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="mb-6 text-xl font-semibold">Основные команды</h2>
        <CommandList />
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          Вебхук VK: <code className="font-mono">/api/vk</code> · Supabase +
          Grok (xAI) · Vercel
        </div>
      </footer>
    </main>
  )
}
