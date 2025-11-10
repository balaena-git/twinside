# Frontend — TwinSide

Коротко: в проекте статический фронтенд в папке `frontend/`. Сервер Express (в `backend`) отдаёт эти файлы. Я ввёл простой клиентский include-лоадер (`/js/include.js`) и пример разбиения page-скриптов в `/js/pages/`.

Что изменено
- `frontend/js/include.js` — простой fetch-лоадер для вставки HTML. Использование: `<div data-include="/components/header.html"></div>`
- `frontend/js/pages/` — папка для page-специфичных скриптов. Сейчас есть `auth.js` и `profile-setup.js`.
- `frontend/admin/components/` — компоненты для админки (header/footer)

Как править страницы
1. Структура
   - Публичные страницы: `frontend/public/*.html`
   - Клиентская часть приложения: `frontend/app/*.html` и `frontend/app/js/*` (app-shell уже динамически вставляет `/app/components/*`)
   - Админка: `frontend/admin/*.html` и `frontend/admin/js/*`

2. Header/footer includes
   - Для общих header/footer используйте `<div data-include="/components/header.html"></div>` и `<div data-include="/components/footer.html"></div>` (для админки — `/admin/components/...`).
   - Include-лоадер (`/js/include.js`) автоматически вставляет HTML и диспатчит событие `include:loaded` на элементе-обёртке.

3. Page-specific JS
   - Вынесите логику, специфичную для страницы, в `frontend/js/pages/<page>.js` и подключите её через `<script src="/js/pages/<page>.js" defer></script>` в HTML.
   - Чтобы сохранить обратную совместимость, корневые файлы `frontend/js/auth.js` и `frontend/js/profile-setup.js` оставлены как lightweight loader'ы, которые динамически подключают page-скрипты.

Запуск сервера для локальной разработки
1. Перейдите в папку `backend` и установите зависимости (если ещё не установлены):
```
npm install
```
2. Запустите dev-сервер:
```
npm run dev
```
3. Откройте в браузере `http://localhost:3000/public` (порт зависит от конфигурации — см. `backend/package.json` и `backend/src/config.js`).

Проверка работоспособности
- Убедитесь, что при загрузке страницы в DevTools -> Network загружаются `/components/header.html` и `/components/footer.html`.
- В Console ищите ошибки от `include.js` — он логирует неудачные fetch-запросы.

Smoke-test (backend)
- Для проверки backend flows (регистрация/подтверждение/login) есть `backend/tools/smoke.js`. Выполните в `backend`:
```
npm run smoke
```

Советы по отладке и next-steps
- Если header подгружается, но скрипты не инициализируются (например, nav), используйте событие `include:loaded` чтобы запускать init-рутину для включённого блока.
- Можно добавить небольшую «skeleton» разметку в компоненты, чтобы избежать визуального мигания при fetch.
- Следующий шаг — покрыть остальные page-скрипты (перенести повторяющийся код из `frontend/js/*.js` в `frontend/js/pages/`) и постепенно удалить дублирующий код.

Если хотите — могу автоматически пройтись ещё по оставшимся страницам (app уже не трогал) и вынести повторяющиеся скрипты. Напишите, какую страницу хотите видеть в примерах дальше.
