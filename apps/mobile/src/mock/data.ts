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
  caption: string;
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

const bookgram: Author = { username: 'bookgram', avatar: require('@/assets/mock/avatar-bookgram.jpg'), subtitle: 'Bookgram', verified: true };
const sam: Author = { username: 'sam_altman', avatar: require('@/assets/mock/avatar-sam.png'), subtitle: 'Recommended' };
const nori: Author = { username: 'j_nori_k', avatar: require('@/assets/mock/avatar-nori.png'), subtitle: 'Recommended' };

const mx: Author = { username: 'fintech_notes', avatar: require('@/assets/mock/avatar-fintech.png'), subtitle: 'Recommended' };
const gadgets: Author = { username: 'gadget.daily', avatar: require('@/assets/mock/avatar-gadget.png'), subtitle: 'Recommended' };
const stevejobs01: Author = { username: 'stevejobs.01', avatar: require('@/assets/mock/avatar-stevejobs01.png'), subtitle: 'His fans' };

export const BOOKGRAM_AUTHOR = bookgram;

export const WELCOME_STORY: Story = {
  id: 'welcome',
  author: bookgram,
  image: require('@/assets/mock/story-jobs.jpg'),
  caption: 'On this day of honoring Steve Jobs` legacy as a relentless innovator, pursuer of perfection and the person who made computers personal.',
  timeAgo: '4 hours ago',
};

export const FOLLOWING_STORIES: Story[] = [
  {
    id: 's1',
    author: sam,
    image: require('@/assets/mock/post-spiderman.jpg'),
    caption: 'Morning pages before the first meeting.',
    timeAgo: '2 hours ago',
  },
  {
    id: 's2',
    author: nori,
    image: require('@/assets/mock/post-timcook.jpg'),
    caption: 'Rewatching this interview for the third time.',
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

ARTICLES.tinkov = {
  id: 'tinkov',
  author: mx,
  cover: require('@/assets/mock/explore-tinkov.png'),
  title: 'How Tinkov Managed to Recreate his Tinkov Bank in Mexico',
  likes: 1312,
  comments: 204,
  shares: 96,
  body: [
    'Plata launched in Mexico with a familiar playbook: no branches, a credit card as the entry product and an app that does everything a branch would.',
    'The team behind it had built the same model once before. They knew which parts of a digital bank matter on day one and which can wait for years.',
    'The result is a company that grew faster in its first year than most local banks did in a decade, under a new name “Plata”.',
  ],
};

ARTICLES.iphoneDuo = {
  id: 'iphoneDuo',
  author: gadgets,
  cover: require('@/assets/mock/explore-iphone.png'),
  title: 'Why iPhone Duo is The Best Foldable of the whole market',
  likes: 987,
  comments: 311,
  shares: 58,
  body: [
    'Most foldables ask you to change how you use a phone. The Duo does not: folded, it is simply an iPhone.',
    'Unfolded, the crease is barely visible and apps resize without a pause. It feels less like a gadget and more like a small tablet you always carry.',
    'That is why it will be a tremendous success in terms of sales: it removes the compromise instead of selling it as a feature.',
  ],
};

ARTICLES.stevePresentations = {
  id: 'stevePresentations',
  author: stevejobs01,
  cover: require('@/assets/mock/explore-steve-presentations.png'),
  title: 'How Steve Does such Great Presentations. Explaining through the analysis of his products release performances',
  likes: 4210,
  comments: 640,
  shares: 377,
  body: [
    'Every keynote followed the same structure: one headline, three points, and a single moment the audience would repeat afterwards.',
    'The slides were almost empty. A photo, a number, a few words. The story lived in what he said, not in what was on screen.',
    'And he rehearsed for weeks. What looked effortless on stage was the most prepared hour of the year.',
  ],
};

ARTICLES.steveIve = {
  id: 'steveIve',
  author: stevejobs01,
  cover: require('@/assets/mock/explore-habits.png'),
  title: 'All the 7 Extraordinary Habits Steve Practiced as a teenager and in his 20s',
  likes: 3380,
  comments: 512,
  shares: 290,
  body: [
    'Long walks instead of meeting rooms. Saying no to almost everything. Reading design magazines the way others read the news.',
    'Most of the habits look simple on paper. What made them extraordinary was that he kept them for decades.',
    'And how this is connected with the products we use today is easier to see than you might think.',
  ],
};

/** Figma 3163:1520 — Explore topics row ("+" sits after the selected topic). */
export const EXPLORE_TOPICS = ['For You', 'Books', 'Science', 'Health', 'History', 'Philosophy'] as const;

export type ExplorePost = {
  id: string;
  image: ImageSourcePropType;
  title: string;
  /** Leading words in bold, like "How Tinkov" in the design. */
  lead: string;
  rest: string;
  timeAgo: string;
  /** "100K" → "100K reads · 1 day ago" under the caption. */
  reads?: string;
  articleId: string;
};

export const EXPLORE_FEED: ExplorePost[] = [
  // The two posts from the Explore frame (THIS.svg); they open existing mock articles.
  {
    id: 'e-kindergarten',
    image: require('@/assets/mock/explore-kindergarten.jpg'),
    title: 'Wiggling is Welcome in This Kindergarten Classroom',
    lead: 'Kim',
    rest: ' Broomer`s classroom is one of the most unique and supportive learning environments I`ve ever seen in life',
    timeAgo: '1 day ago',
    reads: '100K',
    articleId: 'tinkov',
  },
  {
    id: 'e-nurse',
    image: require('@/assets/mock/explore-nurse.jpg'),
    title: 'This Heroic Nurse Climbs 1000-foot ladder to save lives',
    lead: 'Agnes',
    rest: ' Nambozo goes to extraordinary lengths to vaccinate children in Uganda',
    timeAgo: '2 weeks ago',
    reads: '1M',
    articleId: 'iphoneDuo',
  },
  {
    id: 'e1',
    image: require('@/assets/mock/explore-tinkov.png'),
    title: 'How Tinkov Managed to Recreate his Tinkov Bank in Mexico',
    lead: 'How Tinkov',
    rest: ' managed to recreate his Tinkov Bank model in Mexico so successfully under a new name “Plata”',
    timeAgo: '1 week ago',
    reads: '100K',
    articleId: 'tinkov',
  },
  {
    id: 'e2',
    image: require('@/assets/mock/explore-iphone.png'),
    title: 'Why iPhone Duo is The Best Foldable of the whole market',
    lead: 'Why iPhone',
    rest: ' Duo is the best foldable of the whole market and why it will be a tremendous success in terms of sales',
    timeAgo: '2 days ago',
    reads: '1M',
    articleId: 'iphoneDuo',
  },
  {
    id: 'e3',
    image: require('@/assets/mock/explore-steve-presentations.png'),
    title: 'How Steve Does such Great Presentations. Explaining through the analysis',
    lead: 'How Steve',
    rest: ' does such great presentations. Explaining through the analysis of his products release performances',
    timeAgo: '1 week ago',
    reads: '24K',
    articleId: 'stevePresentations',
  },
];

/** Figma 3170:2017 — article results for "Steve Jobs". */
export const SEARCH_ARTICLES: ExplorePost[] = [
  EXPLORE_FEED[4],
  {
    id: 'r2',
    image: require('@/assets/mock/explore-habits.png'),
    title: 'All the 7 Extraordinary Habits Steve Practiced as a teenager',
    lead: 'All the',
    rest: ' 7 extraordinary habits Steve practiced as a teenager and in his 20s. And how this is connected with the products we use today',
    timeAgo: '2 days ago',
    reads: '310K',
    articleId: 'steveIve',
  },
  ...EXPLORE_FEED.slice(2, 4),
];

/** Figma 3158:793 — query completions. */
export const SEARCH_SUGGESTIONS = [
  'Steve Jobs',
  'Steve Jobs` genius',
  'Steve Jobs` habits',
  'Steve Jobs biography review',
  'Steve Jobs speech Stanford',
  'Steve Jobs and his diet',
  'Steve Jobs and the iPhone',
  'Tinkov bank',
  'Tinkov Plata Mexico',
  'iPhone Duo',
  'iPhone Duo review',
];

/** Figma 3159:1041 — profile results. */
export const SEARCH_PROFILES: Author[] = [
  stevejobs01,
  { username: 'oleg_tinkov', avatar: require('@/assets/mock/avatar-tinkov.png'), subtitle: 'Oleg Tinkov' },
  { username: 'stevie_live', avatar: require('@/assets/mock/avatar-stevie-live.png'), subtitle: 'Unofficial store' },
  { username: 'steven._', avatar: require('@/assets/mock/avatar-steven.png'), subtitle: 'bibibi' },
  { username: 'steven_fans', avatar: require('@/assets/mock/avatar-steven-fans.png'), subtitle: 'Official fan acc' },
  { username: 'jobs.quotes', avatar: require('@/assets/mock/avatar-jobs-quotes.png'), subtitle: 'In his words...' },
  { username: 'jobsie_mini', avatar: require('@/assets/mock/avatar-jobsie-mini.png'), subtitle: 'apple fans' },
  sam,
  nori,
];

/** Figma 3167:1542 — someone else's profile. */
export type ProfilePost = {
  id: string;
  image: ImageSourcePropType | null;
  title: string;
  likes: string;
  timeAgo: string;
  articleId?: string;
};

export type Profile = {
  username: string;
  name: string;
  avatar: ImageSourcePropType | null;
  articles: number;
  followers: string;
  following: number;
  bio: string[];
  posts: ProfilePost[];
};

const tinkovProfile: Profile = {
  username: 'oleg_tinkov',
  name: 'Oleg Tinkov',
  avatar: require('@/assets/mock/avatar-tinkov.png'),
  articles: 42,
  followers: '1,5M',
  following: 20,
  bio: ['Owner at Plata - “Banco Plata”', 'Grandpa, father and husband 👨‍🦳', 'Love cycling 🚵, and cycling again. And money 💴 a bit.'],
  posts: [
    {
      id: 't1',
      image: require('@/assets/mock/thumb-plata.png'),
      title: 'How Tinkov managed to recreate his Tinkov Bank model in Mexico so successfully under a new name “Plata”',
      likes: '1.2K',
      timeAgo: '5 days ago',
      articleId: 'tinkov',
    },
    { id: 't2', image: require('@/assets/mock/thumb-bill.png'), title: 'Which 12 books Bill recommends to read. His most favourite ones!', likes: '20', timeAgo: '2 weeks ago' },
    { id: 't3', image: require('@/assets/mock/thumb-yacht.png'), title: 'Why “La Datcha” luxury rents is my favourite work for the past 10 years.', likes: '200', timeAgo: '1 month ago' },
    { id: 't4', image: require('@/assets/mock/thumb-nyc.png'), title: 'What 2 years of living in New York taught me about business', likes: '45', timeAgo: '2 months ago' },
  ],
};

/** Profile by username; unknown users get an empty profile built from their search entry. */
export function getProfile(username: string): Profile {
  if (username === tinkovProfile.username) return tinkovProfile;
  const author = SEARCH_PROFILES.find((a) => a.username === username);
  return {
    username,
    name: author?.subtitle ?? username,
    avatar: author?.avatar ?? null,
    articles: 0,
    followers: '0',
    following: 0,
    bio: [],
    posts: [],
  };
}

/** Figma 3184:1274 / 3185:1524 — Followers / Following rows (subtitle "robertus" as in the design). */
export type Connection = { username: string; subtitle: string; avatar: ImageSourcePropType | null; following: boolean; /** Backend user id (real lists); mock rows have none. */ id?: string; isMe?: boolean };

export const CONNECTIONS: Connection[] = [
  { username: 'jobsie_popsi', subtitle: 'robertus', avatar: require('@/assets/mock/f-jobsie-popsi.png'), following: false },
  { username: 'kamida.pg', subtitle: 'robertus', avatar: require('@/assets/mock/f-kamida.png'), following: false },
  { username: 'working_01', subtitle: 'robertus', avatar: require('@/assets/mock/f-working01.png'), following: false },
  { username: 'maximus.', subtitle: 'robertus', avatar: require('@/assets/mock/f-maximus.png'), following: false },
  { username: 'olegtinkov', subtitle: 'robertus', avatar: require('@/assets/mock/f-olegtinkov.png'), following: true },
  { username: 'the_stranger', subtitle: 'robertus', avatar: require('@/assets/mock/f-stranger.png'), following: true },
  { username: 'michoel10', subtitle: 'robertus', avatar: require('@/assets/mock/f-michoel.png'), following: true },
  { username: 'michael_dimarrt', subtitle: 'robertus', avatar: require('@/assets/mock/f-dimarrt.png'), following: true },
];
