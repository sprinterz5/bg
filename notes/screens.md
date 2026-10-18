# Экраны экспорта BG(2) (2026-10-18)

Имена файлов меняются от экспорта к экспорту, сверяйся по содержимому.

| Файл | Экран | Код (`apps/mobile/src/app/…`) |
|---|---|---|
| No Layout.svg | Сплэш «Thoughts» | `(auth)/welcome.tsx` (заставка) |
| AutoLayouted.svg | Welcome: «Get smarter with friends.», Create an account, Log in by username | `(auth)/welcome.tsx` |
| No layout.svg, AutoLayouted-1.svg | Регистрация: имя | `(auth)/name.tsx` |
| No layout-1.svg, No Layout-1.svg, AutoLayouted-2.svg | Регистрация: username (обычный / «already taken») | `(auth)/username.tsx` |
| AutoLayouted-3.svg | Регистрация: пароль | `(auth)/password.tsx` |
| AutoLayouted-4.svg | Регистрация: повтор пароля | `(auth)/password-confirm.tsx` |
| AutoLayotued.svg, AutoLayotued-1.svg | Регистрация: аватар (пусто / выбран) | `(auth)/avatar.tsx` |
| AutoLayoyted.svg, No layout-2.svg | Регистрация: интересы | `(auth)/interests.tsx` |
| AutoLayouted-34.svg | Home: сторис + лента (For you / Following / Learn / Grow) | `(tabs)/(home)/index.tsx`, `components/feed-post.tsx` |
| AutoLayouted-35.svg | Home: то же, сторис только свой | там же |
| AutoLayouted-33.svg | Уведомления | `notifications.tsx` |
| AutoLayouted-12.svg | Explore (For You / Learn / Ideas / Grow) | `(tabs)/(search)/search.tsx` |
| AutoLayouted-7, -8, -9, -13 .svg | Поиск: ввод, профили, статьи | `(tabs)/(search)/search.tsx` |
| AutoLayouted-15.svg | Пост: превью | `article/[id].tsx` |
| AutoLayouted 17.svg, AutoLayouted-14.svg | Пост: страница текста | `article/[id].tsx` |
| Autolayouted-5, -6, NOAutoLayout .svg | Пост: поделиться (share sheet) | `components/share-sheet.tsx` |
| AutoLayouted 20.svg | Create: «Start writing…» | `(tabs)/create.tsx` |
| AutoLayouted-16 … -19.svg | New Article (редактор статьи) | `new-article.tsx`, **не перенесён** |
| AutoLayouted-32.svg, NOLayout.svg | Choose a cover | `cover-picker.tsx` |
| AutoLayouted-5.svg, AutoLayouted-6.svg | Create a story: галерея | `story/new.tsx` |
| AutoLayouted-30, -31, NOLayout-1, NOlayout .svg | New story: подпись, Share | `story/new.tsx` |
| Autolayouted.svg, -1 … -4 .svg | Просмотр сторис (+ ответ «Send message») | `story/[id].tsx` |
| AutoLayouted 18.svg | Чаты (список) | `(tabs)/(chat)/chat.tsx` |
| AutoLayouted 21, 22, 23 .svg | Поиск в чатах | `(tabs)/(chat)/chat-search.tsx` |
| AutoLayouted-25 … -29.svg | Переписка | `conversation/[id].tsx` |
| AutoLayouted-24.svg | Переписка: ввод | `conversation/[id].tsx` |
| AutoLayouted-20.svg | Чужой профиль | `user/[username]/index.tsx` |
| AutoLayouted-21.svg, AutoLayouted-22.svg | Свой профиль (с постами / пустой) | `(tabs)/(profile)/profile.tsx` |
| AutoLayouted-23.svg | (?) «Thoughts — welcome to the…», по слоям похоже на пост в профиле | `(tabs)/(profile)/profile.tsx` |
| AutoLayouted-10.svg, NOAUTOLAYOUT.svg, AutoLayouted-11.svg | Followers / Following | `user/[username]/followers.tsx`, `following.tsx` |
| The ORIG. toolbar + orig. SEARCH page(-1).svg | Edit profile | `(tabs)/(profile)/edit-profile.tsx` |
| The ORIG. toolbar + orig. SEARCH page-2.svg | Edit bio | `(tabs)/(profile)/edit-bio.tsx` |
