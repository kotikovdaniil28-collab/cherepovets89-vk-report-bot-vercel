const CARDS = [
  { file: "help.png", title: "Команды", trigger: "/help" },
  { file: "reports.png", title: "Отчёты", trigger: "/help отчеты" },
  { file: "km.png", title: "Модерация", trigger: "/help модер" },
  { file: "punish.png", title: "Наказания", trigger: "/help наказания" },
  { file: "gm.png", title: "Руководство", trigger: "/help гм" },
  { file: "apps.png", title: "Заявки", trigger: "/help заявки" },
  { file: "staff.png", title: "Состав", trigger: "/help состав" },
  { file: "ai.png", title: "Нейросеть", trigger: "/help аи" },
  { file: "panel.png", title: "Панель", trigger: "/панель" },
  { file: "welcome.png", title: "Приветствие", trigger: "новый участник" },
]

export function CardsGallery() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((card) => (
        <li
          key={card.file}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <img
            src={`/cards/${card.file}`}
            alt={`Карточка «${card.title}» в стиле Black Russia`}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm font-medium">{card.title}</span>
            <code className="font-mono text-xs text-muted-foreground">
              {card.trigger}
            </code>
          </div>
        </li>
      ))}
    </ul>
  )
}
