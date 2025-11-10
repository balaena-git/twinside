## Быстрая справка для AI-агентов — twinside

Коротко: это монолитный Node.js (ESM) бэкенд + статический фронтенд в папке `frontend`. Бэкенд использует Express и SQLite (better-sqlite3) и хранит файлы загрузок в `backend/uploads`.

Что важно знать (архитектура и потоки)
- Код сервера: `backend/src/index.js` — точка входа. Там выполняются простые миграции (PRAGMA / ALTER TABLE) при старте.
- DB: `backend/src/db.js` использует better-sqlite3 (synchronous API). Файл базы: `backend/src/twinside.sqlite`.
- Маршруты: `backend/src/routes/` разделены на `admin` и `public`. Под-модули админки лежат в `routes/admin/*`.
- Репозитории: SQL-запросы инкапсулированы в `backend/src/repositories/*` (пример: `usersRepository.js`) — используйте их для доступа к БД.
- Мидлвары: `backend/src/middlewares/` (например `auth.js`) — аутентификация через JWT, который хранится в cookie с именем `auth`.
- Загрузки: папка `backend/uploads` содержит `avatars`, `photos`, `ads`, `support`, `verify`. В `index.js` разрешён доступ только к публичным каталогам: `avatars`, `support`, `ads`, `photos` — остальные, например `verify`, не обслуживаются статически.

Dev / запуск
- Убедитесь, что в `backend/.env` заданы ключи: `JWT_SECRET` (обязателен) и `SESSION_SECRET` (если отсутствует, используется JWT_SECRET). Файл читается из `backend/src/config.js` (`../.env`).
- Установка/запуск: в папке `backend` используются npm-скрипты из `package.json`. Обычные команды:
  - `npm install` (установить deps)
  - `npm run dev` — запуск с nodemon (development)
  - `npm start` — production

Проектные соглашения и паттерны
- ESM-модули (package.json содержит "type": "module"). Используйте import/export.
- DB — синхронный доступ (better-sqlite3). Не пытайтесь менять на асинхронные вызовы внутри репозиториев — весь код ожидает синхронного поведения.
- Миграции выполняются в рантайме в `index.js` и в отдельных `ensure*Tables()` (например в `routes/admin/bootstrap.js` и `routes/admin/finance.js`). Поэтому при изменении схемы добавляйте обратимые ALTER/CREATE в те места.
- Статические файлы фронтенда находятся в `frontend/` и обслуживаются из `index.js` (пути: `/assets`, `/components`, `/js`, `/admin`, публичная `frontend/public`).
- Аутентификация: JWT хранится в cookie `auth`. Мидлвар `auth.js` делает `jwt.verify(token, JWT_SECRET)` и на `401` очищает cookie.

Интеграции и внешние зависимости
- Почта: `backend/src/services/mailService.js` использует nodemailer. Провайдер конфигурируется через .env.
- Файловые загрузки: используют `multer`; загрузки сохраняются в `backend/uploads/*`.
- Сессии: `express-session` используется (cookie настроено из `SESSION_SECRET`, `COOKIE_SECURE`, `SAME_SITE`).

Примеры конкретных задач (как делать правки безопасно)
- Добавление колонки в users: обновите миграцию в `backend/src/index.js` (там уже есть примеры ALTER TABLE) и при необходимости обновите репозитории, затем протестируйте локально запуском `npm run dev`.
- Новая таблица администратора: используйте `ensureAdminTables()` паттерн (см. `routes/admin/bootstrap.js`) или добавьте аналогичную функцию и вызов при старте.
- Работа с пользователем: используйте `backend/src/repositories/usersRepository.js` — содержит подготовленные SQL выражения и примеры вставки/обновления.

Проверки и ограничения
- Нет автоматических тестов в репозитории: изменения стоит проверять вручную локально. Запуск сервера сразу применяет SQL миграции — делайте бэкап `twinside.sqlite`, если работаете с продовыми данными.
- Не раскрывать `uploads/verify` через статический сервер — это сделано намеренно (чувствительные верификационные изображения).

Частые места для правок / отладки
- `backend/src/index.js` — порядок middleware/роутов и миграции, статическая раздача фронта.
- `backend/src/config.js` — обязательные env-переменные и пути.
- `backend/src/db.js` и `backend/src/twinside.sqlite` — если поведение БД странное, проверяйте PRAGMA и индексы прямо в коде.

Если что-то непонятно — спросите:
- Нужны ли дополнительные env-примеры (.env.example)?
- Хотите, чтобы я добавил базовую инструкцию по бэкапу/восстановлению SQLite и небольшую проверку health endpoints?

Файлы для быстрого просмотра:
- `backend/src/index.js` — точка входа, миграции, статические пути
- `backend/src/config.js` — env/параметры
- `backend/src/db.js` — подключение к SQLite
- `backend/src/middlewares/auth.js` — как работает JWT cookie
- `backend/src/repositories/usersRepository.js` — пример работы с DB
