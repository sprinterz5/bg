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
  /** Display name where the design shows one (Explore rows: "Bill Gates"); otherwise derived from the username. */
  name?: string;
};

export type Story = {
  id: string;
  author: Author;
  image: ImageSourcePropType;
  caption: string;
  timeAgo: string;
  /** Already watched: grey ring on the home row. */
  seen?: boolean;
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
  /** Eye counter on the home card (Frame 1049); falls back to likes. */
  views?: number;
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

const bookgram: Author = { username: 'smarts', avatar: require('@/assets/mock/avatar-bookgram.jpg'), subtitle: 'Smarts', verified: true };
const sam: Author = { username: 'sam_altman', avatar: require('@/assets/mock/avatar-sam.png'), subtitle: 'Recommended' };
const nori: Author = { username: 'j_nori_k', avatar: require('@/assets/mock/avatar-nori-2.jpg'), subtitle: 'Recommended' };

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

const miniBill: Author = { username: 'mini.bill_g', name: 'Bill Gates', avatar: require('@/assets/mock/avatar-mini-bill.jpg'), subtitle: 'Recommended for you' };
// Frame 1198 Explore / search authors.
const miniBoozie: Author = { username: 'mini_boozie', name: 'Mini Boozie', avatar: require('@/assets/mock/avatar-mini-boozie.jpg'), subtitle: 'Recommended' };
const boss: Author = { username: 'boss', name: 'Boss', avatar: require('@/assets/mock/avatar-boss.jpg'), subtitle: 'Recommended' };
const billijean: Author = { username: 'billijean', avatar: require('@/assets/mock/avatar-billijean.jpg'), subtitle: 'Recommended for you' };
const dinara: Author = { username: 'dinara_satzhan', avatar: require('@/assets/mock/avatar-dinara.jpg'), subtitle: '' };

/** Home stories row (Frame 1049): the circles show the story photo; the last one is already watched. */
export const HOME_STORIES: Story[] = [
  { id: 'hs-timcook', author: { ...dinara, username: 'timcook' }, image: require('@/assets/mock/story-timcook.jpg'), caption: 'Keynote day. Thank you all for watching — more tomorrow!', timeAgo: '1h ago' },
  { id: 'hs-diamo1', author: { ...dinara, username: 'diamo1' }, image: require('@/assets/mock/story-diamo1.jpg'), caption: 'My love and my whole heart is this person, the person whom I love more than anyone in the world is here tonight', timeAgo: '2h ago' },
  { id: 'hs-mason', author: { ...dinara, username: 'mason_th' }, image: require('@/assets/mock/story-mason.jpg'), caption: 'Best night with the best people', timeAgo: '3h ago' },
  { id: 'hs-stevie', author: { ...dinara, username: 'stevie1' }, image: require('@/assets/mock/story-stevie.jpg'), caption: '1984. Still the best launch ever.', timeAgo: '5h ago', seen: true },
  { id: 'hs-rainbow', author: dinara, image: require('@/assets/mock/story-rainbow.jpg'), caption: 'My love and my whole heart is this person, the person whom I love more than anyone in the world is here tonight', timeAgo: '2h ago', seen: true },
];

export const FEED: Post[] = [
  // Frame 1198 home card.
  {
    id: 'p-nighty',
    author: miniBill,
    image: require('@/assets/mock/post-habits.jpg'),
    title: '3 Nighty Habits That Helped Steve Jobs to Rest and Charge',
    caption: 'and these are not simple ones like meditation or journaling, these are really the unique ones',
    timeAgo: '1 day ago',
    likes: 520,
    comments: 14,
    shares: 39,
    views: 520,
    articleId: 'journal',
  },
  {
    id: 'p-kindergarten',
    author: miniBill,
    image: require('@/assets/mock/explore-kindergarten.jpg'),
    title: 'Wiggling Is Welcome in This Kindergarten Classroom',
    caption: 'Kim Broomer`s classroom is one of the most unique and supportive learning environronments I`ve ever seen in life',
    timeAgo: '1 day ago',
    likes: 120,
    comments: 0,
    shares: 39,
    views: 520,
    articleId: 'journal',
  },
  {
    id: 'p-foldables',
    author: billijean,
    image: require('@/assets/mock/post-foldables.jpg'),
    title: 'Are Foldables Finally Worth Buying This Year?',
    caption: 'We used three foldable phones for a month. Here is what surprised us and what still needs work',
    timeAgo: '2 days ago',
    likes: 88,
    comments: 0,
    shares: 12,
    views: 1240,
    articleId: 'iphoneDuo',
  },
  {
    id: 'p1',
    author: sam,
    image: require('@/assets/mock/post-spiderman.jpg'),
    title: 'Why I Journal Every Day for an Hour or Two',
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
    title: 'What I Learnt From Tim Cook`s Latest Interview',
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
  title: 'How Tinkov Recreated His Tinkov Bank in Mexico',
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
  title: 'Why iPhone Duo Is the Best Foldable of the Whole Market',
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
  title: 'How Steve Does Such Great Presentations. Explaining Through the Analysis of His Products Release Performances',
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
  title: 'All the 7 Extraordinary Habits Steve Practiced as a Teenager and in His 20s',
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
export const EXPLORE_TOPICS = ['For You', 'Learn', 'Ideas', 'Grow'] as const;
export const RESULT_TABS = ['Related', 'Detailed', 'Quick'] as const;

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
  // Frame 1198 Explore rows: Bill Gates, Mini Boozie, Boss.
  {
    id: 'e-kindergarten',
    image: require('@/assets/mock/explore-kindergarten.jpg'),
    title: 'Wiggling Is Welcome in This Kindergarten Classroom in Germany',
    lead: 'Kim',
    rest: ' Broomer`s classroom is one of the most unique and supportive learning environments I`ve ever seen in life',
    timeAgo: '2d ago',
    reads: '100K',
    articleId: 'tinkov',
  },
  {
    id: 'e-nighty',
    image: require('@/assets/mock/post-habits.jpg'),
    title: '3 Nighty Habits That Helped Steve Jobs Rest and Recharge',
    lead: '',
    rest: 'and these are not simple ones like meditation or journaling.',
    timeAgo: '3mon ago',
    reads: '3K',
    articleId: 'tinkov',
  },
  {
    id: 'e-mason',
    image: require('@/assets/mock/story-mason.jpg'),
    // Cut off in the design ("…in Such Sl"); the end is made up.
    title: 'Why Mason Thames Started to Play in Such Slow Films',
    lead: '',
    rest: 'He turned down two blockbusters this year. In a long talk he explains why quiet roles teach him more.',
    timeAgo: '2w ago',
    reads: '12K',
    articleId: 'tinkov',
  },
  {
    id: 'e-nurse',
    image: require('@/assets/mock/explore-nurse.jpg'),
    title: 'This Heroic Nurse Climbs 1000-Foot Ladder to Save Lives',
    lead: 'Agnes',
    rest: ' Nambozo goes to extraordinary lengths to vaccinate children in Uganda',
    timeAgo: '2 weeks ago',
    reads: '1M',
    articleId: 'iphoneDuo',
  },
  {
    id: 'e1',
    image: require('@/assets/mock/explore-tinkov.png'),
    title: 'How Tinkov Recreated His Tinkov Bank in Mexico',
    lead: 'How Tinkov',
    rest: ' managed to recreate his Tinkov Bank model in Mexico so successfully under a new name “Plata”',
    timeAgo: '1 week ago',
    reads: '100K',
    articleId: 'tinkov',
  },
  {
    id: 'e2',
    image: require('@/assets/mock/explore-iphone.png'),
    title: 'Why iPhone Duo Is the Best Foldable of the Whole Market',
    lead: 'Why iPhone',
    rest: ' Duo is the best foldable of the whole market and why it will be a tremendous success in terms of sales',
    timeAgo: '2 days ago',
    reads: '1M',
    articleId: 'iphoneDuo',
  },
  {
    id: 'e3',
    image: require('@/assets/mock/explore-steve-presentations.png'),
    title: 'How Steve Gives Such Great Presentations',
    lead: 'How Steve',
    rest: ' does such great presentations. Explaining through the analysis of his products release performances',
    timeAgo: '1 week ago',
    reads: '24K',
    articleId: 'stevePresentations',
  },
  {
    id: 'e-habits',
    image: require('@/assets/mock/explore-habits.png'),
    title: 'The Tiny Habits That Quietly Change Your Whole Year',
    lead: 'Small',
    rest: ' routines compound faster than big resolutions — here is how to start one this week',
    timeAgo: '3 hours ago',
    reads: '56K',
    articleId: 'journal',
  },
  {
    id: 'e-spiderman',
    image: require('@/assets/mock/post-spiderman.jpg'),
    title: 'Why the New Spider-Man Film Broke Every Record',
    lead: 'Spider-Man',
    rest: ' returns with the biggest opening weekend in years and critics can not stop talking about it',
    timeAgo: '5 hours ago',
    reads: '240K',
    articleId: 'tinkov',
  },
  {
    id: 'e-timcook',
    image: require('@/assets/mock/post-timcook.jpg'),
    title: 'Tim Cook on What Comes After the iPhone',
    lead: 'Tim Cook',
    rest: ' shares how Apple thinks about the next decade of devices and why he is not worried',
    timeAgo: '2 days ago',
    reads: '1.2M',
    articleId: 'timcook',
  },
  {
    id: 'e-jobs',
    image: require('@/assets/mock/story-jobs.jpg'),
    title: 'Steve Jobs and the Art of Saying No',
    lead: 'Steve Jobs',
    rest: ' famously cut Apple’s product line to four — the lesson still works for any team today',
    timeAgo: '4 days ago',
    reads: '830K',
    articleId: 'journal',
  },
  {
    id: 'e-foldables',
    image: require('@/assets/mock/explore-iphone.png'),
    title: 'Are Foldables Finally Worth Buying in 2026?',
    lead: 'Foldables',
    rest: ' got lighter, cheaper and tougher this year — we tested five of them for a month',
    timeAgo: '1 week ago',
    reads: '310K',
    articleId: 'iphoneDuo',
  },
  {
    id: 'u-lake',
    image: { uri: 'https://images.unsplash.com/photo-1741893041975-94a0e8656209?w=1200&q=70&auto=format&fit=crop' },
    title: 'The Quiet Lakes Nobody Puts on Travel Lists',
    lead: 'Hidden',
    rest: ' lakes in the Alps where you can still have a whole morning to yourself',
    timeAgo: '2 hours ago',
    reads: '42K',
    articleId: 'journal',
  },
  {
    id: 'u-tokyo',
    image: { uri: 'https://images.unsplash.com/photo-1782307873132-2c713c11c1a6?w=1200&q=70&auto=format&fit=crop' },
    title: 'One Night in Tokyo Without a Plan',
    lead: 'Tokyo',
    rest: ' after midnight is a different city: ramen at 3am, neon alleys and trains that stop',
    timeAgo: '6 hours ago',
    reads: '128K',
    articleId: 'journal',
  },
  {
    id: 'u-coffee',
    image: { uri: 'https://images.unsplash.com/photo-1749813387632-046a0a68c0fc?w=1200&q=70&auto=format&fit=crop' },
    title: 'What Baristas Know About Coffee That We Don`t',
    lead: 'Baristas',
    rest: ' explain why grind size matters more than the beans you spend a fortune on',
    timeAgo: '1 day ago',
    reads: '67K',
    articleId: 'journal',
  },
  {
    id: 'u-rocket',
    image: { uri: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=1200&q=70&auto=format&fit=crop' },
    title: 'The Next Rocket Launch Could Change Everything',
    lead: 'Reusable',
    rest: ' rockets cut the price of reaching orbit tenfold — here is what comes next',
    timeAgo: '1 day ago',
    reads: '510K',
    articleId: 'timcook',
  },
  {
    id: 'u-library',
    image: { uri: 'https://images.unsplash.com/photo-1784232816038-2b5e3457fa81?w=1200&q=70&auto=format&fit=crop' },
    title: 'Why Old Libraries Still Feel Like Magic',
    lead: 'Old libraries',
    rest: ' are quiet on purpose: architects designed them to slow you down and think',
    timeAgo: '3 days ago',
    reads: '88K',
    articleId: 'journal',
  },
  {
    id: 'u-marathon',
    image: { uri: 'https://images.unsplash.com/photo-1769876579499-7479e1b4e415?w=1200&q=70&auto=format&fit=crop' },
    title: 'From Couch to Marathon in Twelve Months',
    lead: 'Anna',
    rest: ' started running at 34 and finished her first marathon a year later',
    timeAgo: '4 days ago',
    reads: '205K',
    articleId: 'journal',
  },
  {
    id: 'u-waterfall',
    image: { uri: 'https://images.unsplash.com/photo-1784488651568-de68376262d4?w=1200&q=70&auto=format&fit=crop' },
    title: 'Inside the Rainforest That Makes Its Own Rain',
    lead: 'Rainforests',
    rest: ' create their own weather — and losing them changes rainfall far away',
    timeAgo: '5 days ago',
    reads: '74K',
    articleId: 'journal',
  },
  {
    id: 'u-ev',
    image: { uri: 'https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?w=1200&q=70&auto=format&fit=crop' },
    title: 'Is It Finally Time to Buy an Electric Car?',
    lead: 'Electric cars',
    rest: ' got cheaper, chargers got faster — we did the math for an average driver',
    timeAgo: '1 week ago',
    reads: '390K',
    articleId: 'iphoneDuo',
  },
  {
    id: 'u-chef',
    image: { uri: 'https://images.unsplash.com/photo-1763705305577-5dbf14a2570c?w=1200&q=70&auto=format&fit=crop' },
    title: 'Ten Hours in a Michelin Kitchen',
    lead: 'Chef Marco',
    rest: ' lets us follow a full dinner service from the first prep to the last plate',
    timeAgo: '1 week ago',
    reads: '156K',
    articleId: 'journal',
  },
  {
    id: 'u-surf',
    image: { uri: 'https://images.unsplash.com/photo-1760755796323-3020c5d5a77d?w=1200&q=70&auto=format&fit=crop' },
    title: 'Chasing the Perfect Wave in Portugal',
    lead: 'Nazaré',
    rest: ' draws surfers from all over the world to ride the biggest waves on Earth',
    timeAgo: '2 weeks ago',
    reads: '620K',
    articleId: 'journal',
  },
];

/** Figma 3170:2017 — article results for "Steve Jobs". */
// Frame 1198 search results (Related / Detailed).
export const SEARCH_ARTICLES: ExplorePost[] = [
  {
    id: 'r-craziness',
    image: require('@/assets/mock/result-craziness.jpg'),
    title: 'Steve Jobs` Craziness Is Actually His Genius as He Explains Himself',
    lead: '',
    rest: '“Genius and madness - how interconnected these things are” - one interview from 1995 that explains a lot.',
    timeAgo: '2d ago',
    articleId: 'tinkov',
  },
  EXPLORE_FEED[1],
  {
    id: 'r-madness',
    image: require('@/assets/mock/result-madness.jpg'),
    title: 'Steve Jobs` Madness Is Actually His Genius as He Explains Himself',
    lead: '',
    rest: '“Genius and maddness - how closely related these two traits are”, in his own words.',
    timeAgo: '2w ago',
    articleId: 'tinkov',
  },
  EXPLORE_FEED[2],
];

/** Frame 1198 search results, Quick tab: the big picture cards. */
export const QUICK_RESULTS: ExplorePost[] = [
  {
    id: 'q-k2',
    image: require('@/assets/mock/quick-k2.jpg'),
    title: 'K2: Apple`s Newest Documentary About Climbers',
    lead: '',
    rest: 'A 6 series documentary which discovers the climbing of K2 mountain. 20 days of frosty climbing.',
    timeAgo: '3 months',
    reads: '1M',
    articleId: 'tinkov',
  },
  {
    id: 'q-netflix',
    image: require('@/assets/mock/quick-netflix.jpg'),
    title: 'What Went Wrong With These Netflix “SuperHits”',
    lead: '',
    rest: 'Netflix poured so much effort into making these shows successful, but they turned into a failure',
    timeAgo: '3 months',
    reads: '1M',
    articleId: 'tinkov',
  },
  {
    id: 'q-winter',
    image: require('@/assets/mock/quick-winter-k2.jpg'),
    title: 'K2: Apple`s Newest Documentary About Climbers',
    lead: '',
    rest: 'A 6 series documentary which discovers the climbing of K2 mountain. 20 days of frosty climbing.',
    timeAgo: '3 months',
    reads: '1M',
    articleId: 'tinkov',
  },
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
      title: 'How Tinkov Managed to Recreate His Tinkov Bank Model in Mexico So Successfully Under a New Name “Plata”',
      likes: '1.2K',
      timeAgo: '5 days ago',
      articleId: 'tinkov',
    },
    { id: 't2', image: require('@/assets/mock/thumb-bill.png'), title: 'Which 12 Books Bill Recommends to Read. His Most Favourite Ones!', likes: '20', timeAgo: '2 weeks ago' },
    { id: 't3', image: require('@/assets/mock/thumb-yacht.png'), title: 'Why “La Datcha” Luxury Rents Is My Favourite Work for the Past 10 Years.', likes: '200', timeAgo: '1 month ago' },
    { id: 't4', image: require('@/assets/mock/thumb-nyc.png'), title: 'What 2 Years of Living in New York Taught Me About Business', likes: '45', timeAgo: '2 months ago' },
  ],
};

/** Profile by username; other mock authors get a profile built from the mock articles they wrote. */
export function getProfile(username: string): Profile {
  if (username === tinkovProfile.username) return tinkovProfile;
  const author = SEARCH_PROFILES.find((a) => a.username === username) ?? Object.values(ARTICLES).find((a) => a.author.username === username)?.author;
  const posts = authorPosts(username);
  return {
    username,
    name: displayName(username),
    avatar: author?.avatar ?? null,
    articles: posts.length,
    followers: posts.length > 0 ? formatMockCount(seeded(username, 90_000, 300)) : '0',
    following: posts.length > 0 ? seeded(username + 'f', 400, 12) : 0,
    bio: [],
    posts,
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

// ---------------------------------------------------------------------------------------------------------------
// Every post opens its own article: same cover, title and author as the card it was opened from (the reader's
// cover grows out of that picture). Posts that tell the same story share the body text.

const OLEG: Author = SEARCH_PROFILES[1];

const BODIES: Record<string, string[]> = {
  kindergarten: [
    'Kim Broomer’s classroom has no rows of desks. There are wobble stools, standing tables, a rug and a corner with beanbags, and every child chooses where to learn for the next twenty minutes.',
    'Kim noticed years ago that her most restless students were not misbehaving, they were thinking with their bodies. Once moving was allowed, the arguments about sitting still simply stopped.',
    'The rules are short and written by the kids themselves: move without bumping, keep your hands for your own work, and come back to the rug when the chime rings.',
    'Parents were sceptical at first. Then reading scores went up, and the calmest hour of the day became the one right after the movement break.',
  ],
  foldables: [
    'We used three foldable phones as our only phones for a month: calls, maps, photos, long reads on the train and far too many spreadsheets.',
    'The crease is no longer the story. After a week none of us noticed it, and the hinges survived thousands of folds without a single complaint.',
    'What surprised us most was reading. A book-sized screen that fits in a pocket changes how much you read on the go, and the outer screens are finally good enough for quick replies.',
    'What still needs work: weight, battery life on heavy days and the price. If you read a lot, a foldable is worth it this year. If you mostly scroll, it is not there yet.',
  ],
  nurse: [
    'Agnes works at a clinic that sits at the top of a cliff, and the only way to the village below is a wooden ladder bolted into the rock.',
    'Twice a week she climbs down with a backpack of vaccines, bandages and blood-pressure cuffs. The climb takes forty minutes down and an hour back up.',
    'She knows every family by name. Children wait for her at the bottom rung, and the elders keep a chair ready in the shade for her first check-up of the day.',
    'Agnes does not like the word heroic. For her it is the job: the people are down there, so that is where the nurse has to be.',
  ],
  habits: [
    'Big resolutions rarely survive February. Tiny habits do, because they are too small to skip even on a bad day.',
    'Two minutes of reading before bed. One glass of water before coffee. Writing down a single thing you finished today. None of this looks impressive in January.',
    'The trick is to attach a new habit to something you already do. After I pour coffee, I stretch. After I close the laptop, I write tomorrow’s first task on paper.',
    'By December the small things add up: a dozen books, a calmer morning and a clear record of a year you actually lived on purpose.',
  ],
  spiderman: [
    'The new Spider-Man film broke the opening weekend record in thirty countries, and the studio still seems surprised by how big it got.',
    'The reason is simple: it is a story about a teenager who keeps choosing the hard, kind option even when nobody would ever find out.',
    'The action is great, but people come back for the quiet scenes, the ones on rooftops and in a small kitchen in Queens.',
    'It is also the first superhero film in years that is genuinely funny without winking at the audience. That turns out to be rare enough to fill every cinema.',
  ],
  afterIphone: [
    'Asked what comes after the iPhone, Tim Cook did not name a device. He talked about the moment technology fades into the background and simply helps.',
    'His answer kept returning to health. A watch that notices an irregular heartbeat before you do is, in his words, the most important thing the company has shipped.',
    'He was careful about glasses and AI, but clear about the rule: nothing ships until it is useful every day, not only impressive in a demo.',
    'The phone is not going anywhere soon. But the next decade, he hinted, is about the products you forget you are wearing.',
  ],
  sayingNo: [
    'When Steve Jobs returned to Apple, the company sold dozens of products. Within a year he cut the line-up to four: two desktops and two laptops, for consumers and professionals.',
    'People remember the products he launched. Fewer remember the hundreds of good ideas he refused, and that refusal was the actual strategy.',
    'He used to say that focus means saying no to the good ideas, not only the bad ones. The bad ones are easy to reject.',
    'Saying no is uncomfortable because it disappoints someone every time. It is also the only way to make one thing truly great.',
  ],
  lakes: [
    'Travel lists keep sending everyone to the same three lakes. Twenty minutes further down the gravel road there is usually a fourth one with nobody on it.',
    'The quiet lakes have no cafés and no parking signs, just a path through the pines and water so clear you can see the stones two metres down.',
    'Go early. Mist sits on the surface until about eight, and the only sound is a loon somewhere across the bay.',
    'Bring everything back with you, leave the rocks where they are, and maybe do not post the exact location. Part of the magic is that it stays hard to find.',
  ],
  tokyo: [
    'I landed in Tokyo at nine in the evening with no hotel booked and no plan, just a phone at forty percent and a vague idea of finding ramen.',
    'The ramen was in a basement with eight seats and a vending machine for tickets. Nobody spoke English and nobody needed to.',
    'Then a tiny jazz bar on the fourth floor of a narrow building, a karaoke room for two, and a convenience store egg sandwich that is still the best thing I ate that year.',
    'At five in the morning I watched the fish market wake up and finally checked into a capsule hotel. Tokyo is the best city in the world to get a little lost in.',
  ],
  coffee: [
    'Baristas will tell you the beans matter less than you think, and the water matters more. Most bad coffee at home is a water problem.',
    'Grind right before brewing. Ground coffee loses most of its aroma within half an hour, which is why the bag from the supermarket always tastes flat.',
    'Use a scale, not a spoon. Sixty grams of coffee per litre of water is a good place to start, and from there you adjust to taste.',
    'And clean your machine. Old oils turn bitter, and a surprising amount of “strong” coffee is really just a dirty filter.',
  ],
  rocket: [
    'The next launch is not about going further. It is about landing the whole rocket and flying it again a few days later.',
    'Reusable rockets have already cut the price of reaching orbit many times over. Full reuse could cut it again by an order of magnitude.',
    'Cheap launches change what is worth building: bigger telescopes, space stations that are not funded by a single country, maybe even factories in orbit.',
    'If the test works, the most important number in the space industry stops being the payload and becomes the turnaround time.',
  ],
  library: [
    'Old libraries are quiet in a way that modern buildings rarely are. The silence feels deliberate, as if the room itself is paying attention.',
    'Part of it is the light: tall windows, green lamps and dust floating in the afternoon sun over long oak tables.',
    'Part of it is the shelves. Thousands of books you will never read still remind you how much there is to know, and that is strangely comforting.',
    'Most of these libraries are free to visit. Go on a weekday morning, find a corner seat and read something you would never have picked online.',
  ],
  marathon: [
    'Twelve months ago Anna could not run to the end of her street. Last Sunday she crossed the finish line of her first marathon.',
    'She started with a walk-run plan: one minute of running, two minutes of walking, three times a week. Nothing more ambitious than that.',
    'The hardest part was not the long runs, it was the boring Tuesdays when nobody was watching and the weather was bad.',
    'Her advice is short: buy good shoes, slow down more than feels right, and never miss two runs in a row.',
  ],
  rainforest: [
    'Rainforests do not just receive rain, they make it. Every tree pulls water from the soil and breathes it out through its leaves.',
    'That moisture rises, cools and falls again a few hundred kilometres further inland. The Amazon moves more water through the air than the Amazon river carries to the sea.',
    'Scientists call these invisible streams flying rivers. Farms thousands of kilometres away depend on them without knowing it.',
    'Cut enough trees and the cycle breaks: the forest dries out, and the rain that farmers counted on simply stops coming.',
  ],
  ev: [
    'Electric cars used to be a bet on the future. In most cities they are now simply the cheaper car to own over five years.',
    'Range anxiety fades after the first month. Most days you start with a full battery, because the car charges at home overnight like a phone.',
    'Long road trips still need a little planning, and fast chargers are not everywhere yet. A twenty-minute stop every few hours becomes part of the rhythm.',
    'If you can charge at home or at work, it is probably time. If you park on the street, wait one more year and watch the charger map in your area.',
  ],
  chef: [
    'Chef Marco’s kitchen starts at seven in the morning, five hours before the first guest arrives. By then every station has been cleaned twice.',
    'The quietest moment is prep. Forty kilos of vegetables are cut by hand, and the only sounds are knives and a radio nobody listens to.',
    'Service is the opposite: tickets, shouting, plates leaving every thirty seconds. Marco tastes almost every sauce before it goes out.',
    'At midnight, after the last table, the whole team eats together standing up. Marco says that meal is the only one he actually remembers.',
  ],
  surf: [
    'Nazaré is a small fishing town in Portugal that becomes the centre of the surfing world every winter.',
    'An underwater canyon funnels Atlantic swells straight at the beach, building waves taller than a ten-storey building.',
    'The surfers are towed in by jet skis because paddling is impossible at that speed. A wipeout can hold you under for a full minute.',
    'From the lighthouse cliff you can watch it all for free. Bring a jacket, and arrive early: the best waves come with the morning tide.',
  ],
  books: [
    'Bill Gates publishes a list of books every year, and he reads far more than he recommends. These twelve are the ones he keeps returning to.',
    'Most of them are not about business. There is history, a lot of science, two novels and a surprisingly practical book about sleep.',
    'His rule is to finish every book he starts and to write notes in the margins, so he can argue with the author while reading.',
    'If you only pick one, take the book about how energy actually works. He says it changed how he thinks about every other problem on the list.',
  ],
  datcha: [
    'For ten years “La Datcha” has been my favourite work: a small fleet of yachts and villas that I rent out by the week.',
    'It started as a way to pay for my own boat. Then friends of friends asked to rent it, and a side project slowly became a real business.',
    'Luxury is not about gold taps. It is about a crew that remembers how you like your coffee and a captain who knows the quiet bays.',
    'The best part of the job is seeing guests arrive tired and leave a week later as completely different people.',
  ],
  newyork: [
    'Two years in New York taught me more about business than any course I took. The city simply does not wait for anyone.',
    'Lesson one: speed beats perfection. A good offer today wins against a perfect one next month.',
    'Lesson two: everyone is selling something, so the people who listen stand out. I closed more deals by asking questions than by pitching.',
    'Lesson three: rent is the real teacher. When every square metre costs a fortune, you learn very quickly which parts of your business actually earn money.',
  ],
};

// Stable pseudo-random counters per post, so the reader shows the same numbers every time.
function seeded(id: string, max: number, min = 0) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return min + (h % (max - min));
}

function articleFrom(id: string, author: Author, cover: ImageSourcePropType, title: string, body: string[], likes?: number, comments?: number, shares?: number) {
  ARTICLES[id] = {
    id,
    author,
    cover,
    title,
    body,
    likes: likes ?? seeded(id, 4000, 40),
    comments: comments ?? seeded(id + 'c', 400, 3),
    shares: shares ?? seeded(id + 's', 300, 2),
  };
}

// Body source per post: a key into BODIES, or an existing hand-written article.
const BODY_OF: Record<string, string> = {
  'p-nighty': 'habits',
  'e-nighty': 'habits',
  'e-mason': 'spiderman',
  'r-craziness': 'stevePresentations',
  'r-madness': 'sayingNo',
  'q-k2': 'marathon',
  'q-netflix': 'spiderman',
  'q-winter': 'lakes',
  'p-kindergarten': 'kindergarten',
  'p-foldables': 'foldables',
  p1: 'journal',
  p2: 'timcook',
  'e-kindergarten': 'kindergarten',
  'e-nurse': 'nurse',
  e1: 'tinkov',
  e2: 'iphoneDuo',
  e3: 'stevePresentations',
  'e-habits': 'habits',
  'e-spiderman': 'spiderman',
  'e-timcook': 'afterIphone',
  'e-jobs': 'sayingNo',
  'e-foldables': 'foldables',
  'u-lake': 'lakes',
  'u-tokyo': 'tokyo',
  'u-coffee': 'coffee',
  'u-rocket': 'rocket',
  'u-library': 'library',
  'u-marathon': 'marathon',
  'u-waterfall': 'rainforest',
  'u-ev': 'ev',
  'u-chef': 'chef',
  'u-surf': 'surf',
  r2: 'steveIve',
  t1: 'tinkov',
  t2: 'books',
  t3: 'datcha',
  t4: 'newyork',
};

// Explore cards have no author line; their articles still need one.
const EXPLORE_AUTHOR: Record<string, Author> = {
  'e-nighty': miniBoozie,
  'e-mason': boss,
  'r-craziness': miniBill,
  'r-madness': boss,
  'q-k2': mx,
  'q-netflix': gadgets,
  'q-winter': mx,
  'e-kindergarten': miniBill,
  'e-nurse': billijean,
  e1: mx,
  e2: gadgets,
  e3: stevejobs01,
  'e-habits': sam,
  'e-spiderman': nori,
  'e-timcook': nori,
  'e-jobs': stevejobs01,
  'e-foldables': gadgets,
  'u-lake': dinara,
  'u-tokyo': billijean,
  'u-coffee': miniBill,
  'u-rocket': mx,
  'u-library': sam,
  'u-marathon': dinara,
  'u-waterfall': billijean,
  'u-ev': gadgets,
  'u-chef': miniBill,
  'u-surf': nori,
  r2: stevejobs01,
};

function bodyFor(postId: string) {
  const key = BODY_OF[postId];
  return BODIES[key] ?? ARTICLES[key]?.body ?? [];
}

const parseCount = (s?: string) => {
  if (!s) return undefined;
  const n = parseFloat(s.replace(',', '.'));
  return Math.round(/m/i.test(s) ? n * 1e6 : /k/i.test(s) ? n * 1e3 : n);
};

// "1 day ago" of each derived article, for the author's profile list.
const TIME_AGO: Record<string, string> = {};

for (const p of FEED) {
  const id = `a-${p.id}`;
  articleFrom(id, p.author, p.image, p.title, bodyFor(p.id), p.likes, p.comments, p.shares);
  p.articleId = id;
  TIME_AGO[id] = p.timeAgo;
}
// Counters shown in the Frame 1198 rows (likes, shares).
const ROW_STATS: Record<string, [number, number]> = {
  'e-kindergarten': [520, 39],
  'e-nighty': [3000, 212],
  'r-craziness': [520, 39],
  'r-madness': [3000, 212],
};

for (const p of [...EXPLORE_FEED, ...SEARCH_ARTICLES, ...QUICK_RESULTS]) {
  const id = `a-${p.id}`;
  const [likes, shares] = ROW_STATS[p.id] ?? [];
  if (!ARTICLES[id]) articleFrom(id, EXPLORE_AUTHOR[p.id] ?? bookgram, p.image, p.title, bodyFor(p.id), likes, undefined, shares);
  p.articleId = id;
  TIME_AGO[id] ??= p.timeAgo;
}
for (const p of tinkovProfile.posts) {
  if (!p.image) continue;
  const id = `a-${p.id}`;
  articleFrom(id, OLEG, p.image, p.title, bodyFor(p.id), parseCount(p.likes));
  p.articleId = id;
}

/** "sam_altman" → "Sam Altman". */
export function displayName(username: string) {
  return username
    .split(/[._]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatMockCount(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace('.0', '')}K`;
  return String(n);
}

/** Mock articles by this author, one row per title (the same story can sit in several mock lists). */
function authorPosts(username: string): ProfilePost[] {
  const titles = new Set<string>();
  return Object.values(ARTICLES)
    .filter((a) => a.author.username === username && TIME_AGO[a.id])
    .filter((a) => {
      const key = a.title.toLowerCase();
      if (titles.has(key)) return false;
      titles.add(key);
      return true;
    })
    .map((a) => ({ id: a.id, image: a.cover, title: a.title, likes: formatMockCount(a.likes), timeAgo: TIME_AGO[a.id] ?? '', articleId: a.id }));
}
