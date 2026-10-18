# Перенос BG(2): где остановились (2026-10-19)

Сделано (df1eccf):
- Регистрация без почты (бэкенд: email optional, пароль 6+ с буквой; **бэкенд не задеплоен**).
- Welcome, имя, username, пароль, повтор, аватар, интересы выверены через uicheck.

В работе: Home (AutoLayouted-34/-35).
- Готово: иконки feed-* и новые home-plus/home-bell в assets/icons (+ в icon.tsx), картинки
  avatar-daniel / avatar-zhangir / post-room / post-dodo в assets/mock.
- Осталось: переписать components/feed-post.tsx (пост-твит), вкладки For you / Following / Learn / Grow,
  сдвиги шапки и сторис (−1 по x, −4 по y; логотип Caveat 500 ≈35.1), мок FEED (Daniel Kraig, Zhangir Cool).
- Числа из макета: аватар r21 по центру (28.5, 301); имя Inter 700 14.7 (ink 58.4 × 280.9); @handle и «7h»
  Inter 400 14.6 #999, точка 2.2 в 248.1; текст Inter 400 13.9, межстрочный 20.5, с x 57.5, ширина ~305;
  картинка 325.5×226.5 r13.2, обводка #999 0.5, на 14.3 ниже текста; иконки на y≈652 (like 57.5 → «520» 81.5,
  comment 150.4 → «270» 173.2, views 238.2 → «3K» 259.7, bookmark 324.8, share 360.8), счётчики Inter 400 12.35;
  разделитель 0.75 #E9E9E9 с x 2.5 на 686.3; вкладки Inter 500 14.1 (x 18.7 / 114.3 / 231.5 / 326.9, cap top 239.6),
  подчёркивание 59×2 #2A2121 на 265.5, линия #E9E9E9 на 267.

Дальше: остальные экраны через uicheck (профили: таббар в кадре профиля отличается от Home; размеры в профиле
на 4–9% меньше макета), затем заметки в notes/changes.

Инструменты: notes/tools/uicheck.sh <export dir> <frame.svg> <route> [--skip-y A-B] [--shift-y A-B:dy];
нужен web dev server (launch.json mobile-web, порт 8090). textmatch.py, fit.py, ink.py, lines.py,
extract.py (иконки из SVG), images.py (картинки из SVG).
