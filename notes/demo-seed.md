# Демо-контент на сервере (2026-10-22)

Моковые посты приложения перенесены на сервер как настоящие, чтобы лента, статьи, лайки, закладки и отправка
поста в чат работали на реальных данных.

- 13 демо-аккаунтов: daniel_kraig, lesbekov_zh, billijean, sam_altman, j_nori_k, fintech_notes, gadget.daily,
  stevejobs.01, mini.bill_g, mini_boozie, boss, dinara_satzhan, oleg_tinkov. У всех bio `Demo account`,
  пароли случайные и нигде не сохранены (войти под ними нельзя).
- 38 постов (обложки, заголовки, тексты из `apps/mobile/src/mock/data.ts`), даты публикации разбросаны по трём дням.
- Бэкап базы перед загрузкой: `/srv/backups/bookgram-preseed-20261021-2344.sql.gz`.
- В ленте Home моков больше нет (остались только в режиме `?capture`). Сторис, Explore и уведомления пока моковые.

Удалить всё демо (посты удалятся вместе с аккаунтами):

```sql
delete from "User" where bio = 'Demo account';
```
