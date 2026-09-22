import type { ImageSourcePropType } from 'react-native';

export const INTERESTS = [
  { slug: 'world-history', label: 'World history' },
  { slug: 'company-stories', label: 'Companies success stories' },
  { slug: 'philosophy', label: 'Philosophy' },
  { slug: 'zen-meditation', label: 'Zen & Meditation' },
  { slug: 'health-nutrition', label: 'Health & Nutrition' },
  { slug: 'space-universe', label: 'Space & Universe' },
  { slug: 'math-theorems', label: 'Math: unusual theorems' },
  { slug: 'everyday-physics', label: 'Physics in everyday life' },
  { slug: 'history-of-arts', label: 'History of Arts' },
  { slug: 'unusual-cultures', label: 'Unusual cultures & societies' },
  { slug: 'fiction', label: 'Fiction Books' },
  { slug: 'non-fiction', label: 'Non-fiction books' },
  { slug: 'russian-classics', label: 'Russian classics' },
  { slug: 'stoicism', label: 'Stoicism & Other similars' },
  { slug: 'biographies', label: 'Biographies extracts' },
  { slug: 'successful-lives', label: 'Successful peoples lives' },
  { slug: 'silicon-valley', label: 'Silicon Valley news' },
] as const;

export const INTERESTS_MIN = 3;
export const INTERESTS_MAX = 5;

export type Author = {
  username: string;
  avatar: ImageSourcePropType | null;
  subtitle: string;
  verified?: boolean;
};

export type Story = {
  id: string;
  author: Author;
  image: ImageSourcePropType;
  caption: { bold: string; rest: string };
  timeAgo: string;
};

export type Post = {
  id: string;
  author: Author;
  image: ImageSourcePropType;
  title: string;
  caption: string;
  timeAgo: string;
  likes: number;
  comments: number;
  shares: number;
  articleId: string;
};

export type Article = {
  id: string;
  author: Author;
  cover: ImageSourcePropType;
  title: string;
  body: string[];
  likes: number;
  comments: number;
  shares: number;
};

const bookgram: Author = { username: 'bookgram', avatar: require('@/assets/icons/bookgram-avatar-bg.svg'), subtitle: 'Bookgram', verified: true };
const sam: Author = { username: 'sam_altman', avatar: require('@/assets/mock/avatar-sam.png'), subtitle: 'Suggested' };
const nori: Author = { username: 'j_nori_k', avatar: require('@/assets/mock/avatar-nori.png'), subtitle: 'Suggested' };

export const BOOKGRAM_AUTHOR = bookgram;

export const WELCOME_STORY: Story = {
  id: 'welcome',
  author: bookgram,
  image: require('@/assets/mock/story-hello.jpg'),
  caption: { bold: 'Follow', rest: ' people to see their everyday stories.' },
  timeAgo: '4 hours ago',
};

export const FOLLOWING_STORIES: Story[] = [
  {
    id: 's1',
    author: sam,
    image: require('@/assets/mock/post-spiderman.jpg'),
    caption: { bold: 'sam_altman', rest: ' Morning pages before the first meeting.' },
    timeAgo: '2 hours ago',
  },
  {
    id: 's2',
    author: nori,
    image: require('@/assets/mock/post-timcook.jpg'),
    caption: { bold: 'j_nori_k', rest: ' Rewatching this interview for the third time.' },
    timeAgo: '6 hours ago',
  },
];

export const ARTICLES: Record<string, Article> = {
  journal: {
    id: 'journal',
    author: sam,
    cover: require('@/assets/mock/post-spiderman.jpg'),
    title: 'Why I Journal Every Day for 1-2 Hours in This Small Pocket Diary',
    likes: 2084,
    comments: 463,
    shares: 185,
    body: [
      "I started journaling as a way to slow down. Every morning, before opening any messages, I spend an hour with a small pocket diary and a pen. No apps, no notifications, nothing to react to.",
      "The rule is simple: write down what I am thinking about, not what I think I should be thinking about. Most days it is a list of problems. Some days it is a single question I cannot answer yet.",
      "Over time the diary became a map of how my priorities actually move. Things I thought were urgent quietly disappear after a week. Ideas that keep coming back are the ones worth working on.",
      "The second hour happens in the evening. I reread the morning page and write one paragraph about what actually happened. The gap between the two pages is the most honest feedback I get all day.",
      "I keep three recurring sections. The first is people: who I talked to and what I learned from them. The second is decisions: what I decided and why, in one sentence. The third is questions I am still holding.",
      "The decisions section turned out to be the most valuable. Months later I can see not only what I chose, but what I believed at the time. It makes it much harder to rewrite history in my head.",
      "Paper matters more than I expected. It is slow, so I skip the words that do not matter. It cannot be searched, so I remember more of it. And it never interrupts me with something new.",
      "People ask whether two hours is too much. It is the only part of the day where nobody else sets the agenda. Everything else I do is a reaction; this is the one place I decide what matters first.",
      "If you want to try it, start with ten minutes. Keep the notebook small enough to carry everywhere. The point is not to produce anything — it is to notice.",
    ],
  },
  timcook: {
    id: 'timcook',
    author: nori,
    cover: require('@/assets/mock/post-timcook.jpg'),
    title: 'What I Learnt From Watching Tim Cook`s Interview for the Third Time',
    likes: 520,
    comments: 270,
    shares: 80,
    body: [
      "The first time I watched it, I listened for answers. The second time, I listened for the questions he chose not to answer. The third time, I just watched how he spoke.",
      "He never rushes. Every answer begins with a short pause, as if he is deciding which of several true things matters most right now.",
      "The most useful idea for me was about saying no. A company is defined less by what it builds than by the hundred good ideas it decides to leave on the table.",
      "He talks about his calendar the way other people talk about their budget. Every hour is spent on purpose, and the early morning belongs to reading and thinking before the day begins.",
      "Another thing I noticed is how often he credits the team. Not as politeness — he describes specific people and specific decisions, which makes the praise feel earned rather than generic.",
      "When the interviewer pushed on a difficult topic, he did not deflect and he did not overexplain. He stated the position, gave one reason, and stopped. Silence did the rest of the work.",
      "On the third watch I started writing down his phrases. Almost none of them are clever. They are plain, short and repeatable — the kind of sentences a whole company can remember.",
      "I wrote down one line and taped it above my desk: focus is not about the things you do, it is about the things you do not.",
    ],
  },
};

export const FEED: Post[] = [
  {
    id: 'p1',
    author: sam,
    image: require('@/assets/mock/post-spiderman.jpg'),
    title: 'Why I Journal Every Day for 1-2 Hours in This Small...',
    caption: 'Why I journal every day for 1-2 hours in this small pocket diary and what topics do I write down about',
    timeAgo: '1 day ago',
    likes: 2084,
    comments: 463,
    shares: 185,
    articleId: 'journal',
  },
  {
    id: 'p2',
    author: nori,
    image: require('@/assets/mock/post-timcook.jpg'),
    title: 'What I learnt from watching Tim Cook`s interview for...',
    caption: 'Third rewatch, and I still found something new. Notes inside.',
    timeAgo: '2 days ago',
    likes: 520,
    comments: 270,
    shares: 80,
    articleId: 'timcook',
  },
];
