# Демо-контент на сервере (2026-10-22)

Моковые посты приложения перенесены на сервер как настоящие, чтобы лента, статьи, лайки, закладки и отправка
поста в чат работали на реальных данных.

- 13 демо-аккаунтов: daniel_kraig, lesbekov_zh, billijean, sam_altman, j_nori_k, fintech_notes, gadget.daily,
  stevejobs.01, mini.bill_g, mini_boozie, boss, dinara_satzhan, oleg_tinkov. У всех bio `Demo account`,
  пароли случайные и нигде не сохранены (войти под ними нельзя).
- 38 постов (обложки, заголовки, тексты из `apps/mobile/src/mock/data.ts`), даты публикации разбросаны по трём дням.
- Счётчики демо-постов (лайки 135–3377, комментарии, закладки, репосты, просмотры) выставлены прямо в
  `ContentCounter`: это числа, а не настоящие лайки и комментарии. Настоящие действия прибавляются к ним.
- У 14 постов обложки заменены на фото с Unsplash (были повторы и картинки 142–393 px): ссылки прямо на
  images.unsplash.com.
- Комментарии: по 3–9 настоящих комментариев от демо-авторов на каждый пост (40 заготовленных фраз),
  счётчик комментариев = их число.
- Бэкап базы перед загрузкой: `/srv/backups/bookgram-preseed-20261021-2344.sql.gz`.
- В ленте Home моков больше нет (остались только в режиме `?capture`). Сторис, Explore и уведомления пока моковые.

Удалить всё демо (посты удалятся вместе с аккаунтами):

```sql
delete from "Comment" where "userId" in (select id from "User" where bio = 'Demo account');
delete from "ContentCounter" where "targetId" in (select a.id from "Article" a join "User" u on u.id = a."authorId" where u.bio = 'Demo account');
delete from "User" where bio = 'Demo account';
```

## Замена статей (2026-10-27)

- 38 старых демо-постов скрыты (`deletedAt`), не удалены: вернуть можно, обнулив `deletedAt` у постов демо-авторов.
- Вместо них 10 новых статей (тексты и заголовки присланы 2026-10-27): Musk ×2, Silicon Valley, happiness,
  Steve Jobs, Duolingo, LGBTQ+ love, loneliness online, iPhone, ordinary life. Авторы — демо-аккаунты, обложки с
  Unsplash (free license), по 3–6 комментариев из прежних демо-фраз, счётчики выставлены в `ContentCounter`.
- Бэкап перед заменой: `/srv/backups/bookgram-pre-articles-20261027-1445.sql.gz`.
