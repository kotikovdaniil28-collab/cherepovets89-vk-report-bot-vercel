const GROUPS = [
  {
    title: "Общие",
    commands: [
      ["/help", "меню команд с карточкой и кнопками"],
      ["/ид", "ваш VK ID"],
      ["/правило 2.1", "показать пункт правил"],
      ["/термин мут", "объяснение термина"],
    ],
  },
  {
    title: "Нейросеть (Grok)",
    commands: [
      ["/аи <вопрос>", "ответ нейросети с памятью диалога"],
      ["/картинка <описание>", "генерация изображения"],
      ["/бр <сцена>", "картинка в стиле Black Russia"],
      ["/поиск <запрос>", "ответ с поиском в интернете"],
    ],
  },
  {
    title: "Развлечения",
    commands: [
      ["/монетка", "орёл или решка"],
      ["/кубик [граней]", "бросить кубик"],
      ["/шанс <вопрос>", "вероятность в процентах"],
      ["/выбери а или б", "бот выберет за вас"],
      ["/кто <вопрос>", "случайный участник беседы"],
    ],
  },
  {
    title: "Модерация",
    commands: [
      ["/отчет", "отправить отчёт (в беседе отчётов)"],
      ["/мут, /бан", "наказания с реальными ограничениями VK"],
      ["/заявки", "заявки из Google Форм"],
      ["/панель", "панель управления с карточкой"],
    ],
  },
]

export function CommandList() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            {group.title}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.commands.map(([cmd, desc]) => (
              <li key={cmd} className="flex flex-col gap-0.5">
                <code className="font-mono text-sm">{cmd}</code>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {desc}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
