import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const password = "Puzzle123!";

async function upsertUser(input: {
  email: string;
  username: string;
  displayName: string;
  bio: string;
  interests: string[];
  role?: "USER" | "MODERATOR" | "ADMIN";
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      username: input.username,
      displayName: input.displayName,
      bio: input.bio,
      interests: input.interests,
      role: input.role ?? "USER"
    },
    create: {
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      bio: input.bio,
      interests: input.interests,
      role: input.role ?? "USER",
      passwordHash: await argon2.hash(password)
    }
  });
}

async function upsertBook(input: {
  isbn13: string;
  title: string;
  subtitle?: string;
  authors: string[];
  description: string;
  thumbnailUrl: string;
  categories: string[];
  publishedDate: string;
  publisher: string;
  pageCount: number;
}) {
  return prisma.book.upsert({
    where: { isbn13: input.isbn13 },
    update: input,
    create: {
      ...input,
      source: "MANUAL",
      language: "en"
    }
  });
}

async function upsertReview(input: {
  authorId: string;
  bookId: string;
  title: string;
  body: string;
  rating: number;
  tags: string[];
}) {
  const existing = await prisma.review.findFirst({
    where: {
      authorId: input.authorId,
      bookId: input.bookId,
      title: input.title
    }
  });

  if (existing) {
    return prisma.review.update({
      where: { id: existing.id },
      data: {
        ...input,
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        publishedAt: existing.publishedAt ?? new Date(),
        readingTimeMinutes: 3
      }
    });
  }

  return prisma.review.create({
    data: {
      ...input,
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      readingTimeMinutes: 3
    }
  });
}

async function main() {
  const [maya, leo, anika, moderator] = await Promise.all([
    upsertUser({
      email: "maya@puzzle.dev",
      username: "maya_reads",
      displayName: "Maya",
      bio: "Essays, science fiction, and marginalia.",
      interests: ["fiction", "philosophy", "creativity", "science"]
    }),
    upsertUser({
      email: "leo@puzzle.dev",
      username: "leo_notes",
      displayName: "Leo",
      bio: "Reading systems, product thinking, and culture.",
      interests: ["product", "psychology", "essays", "history"]
    }),
    upsertUser({
      email: "anika@puzzle.dev",
      username: "anika_pages",
      displayName: "Anika",
      bio: "Reviews for curious readers.",
      interests: ["novels", "language", "memory", "design"]
    }),
    upsertUser({
      email: "mod@puzzle.dev",
      username: "mod_puzzle",
      displayName: "Puzzle Moderator",
      bio: "Keeps Explore readable.",
      interests: ["moderation"],
      role: "MODERATOR"
    })
  ]);

  const [dune, sapiens, thinking, leftHand] = await Promise.all([
    upsertBook({
      isbn13: "9780441172719",
      title: "Dune",
      authors: ["Frank Herbert"],
      description: "A political, ecological, and spiritual science-fiction epic.",
      thumbnailUrl: "https://covers.openlibrary.org/isbn/9780441172719-L.jpg",
      categories: ["science fiction", "politics", "ecology"],
      publishedDate: "1965",
      publisher: "Ace",
      pageCount: 688
    }),
    upsertBook({
      isbn13: "9780062316097",
      title: "Sapiens",
      subtitle: "A Brief History of Humankind",
      authors: ["Yuval Noah Harari"],
      description: "A sweeping history of humans, stories, power, and cooperation.",
      thumbnailUrl: "https://covers.openlibrary.org/isbn/9780062316097-L.jpg",
      categories: ["history", "anthropology", "ideas"],
      publishedDate: "2015",
      publisher: "Harper",
      pageCount: 464
    }),
    upsertBook({
      isbn13: "9780374533557",
      title: "Thinking, Fast and Slow",
      authors: ["Daniel Kahneman"],
      description: "A landmark book about judgment, bias, and decision-making.",
      thumbnailUrl: "https://covers.openlibrary.org/isbn/9780374533557-L.jpg",
      categories: ["psychology", "behavior", "science"],
      publishedDate: "2011",
      publisher: "Farrar, Straus and Giroux",
      pageCount: 499
    }),
    upsertBook({
      isbn13: "9780441478125",
      title: "The Left Hand of Darkness",
      authors: ["Ursula K. Le Guin"],
      description: "A quiet, profound novel about culture, gender, and trust.",
      thumbnailUrl: "https://covers.openlibrary.org/isbn/9780441478125-L.jpg",
      categories: ["science fiction", "culture", "language"],
      publishedDate: "1969",
      publisher: "Ace",
      pageCount: 304
    })
  ]);

  await Promise.all([
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: maya.id, followingId: leo.id } },
      update: {},
      create: { followerId: maya.id, followingId: leo.id }
    }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: maya.id, followingId: anika.id } },
      update: {},
      create: { followerId: maya.id, followingId: anika.id }
    }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: leo.id, followingId: maya.id } },
      update: {},
      create: { followerId: leo.id, followingId: maya.id }
    })
  ]);

  await Promise.all([
    prisma.shelfItem.upsert({
      where: { userId_bookId: { userId: maya.id, bookId: dune.id } },
      update: { status: "READING", progressPercent: 42 },
      create: { userId: maya.id, bookId: dune.id, status: "READING", progressPercent: 42, startedAt: new Date() }
    }),
    prisma.shelfItem.upsert({
      where: { userId_bookId: { userId: maya.id, bookId: sapiens.id } },
      update: { status: "READ", rating: 4 },
      create: { userId: maya.id, bookId: sapiens.id, status: "READ", rating: 4, finishedAt: new Date() }
    }),
    prisma.shelfItem.upsert({
      where: { userId_bookId: { userId: maya.id, bookId: leftHand.id } },
      update: { status: "WANT_TO_READ" },
      create: { userId: maya.id, bookId: leftHand.id, status: "WANT_TO_READ" }
    }),
    prisma.shelfItem.upsert({
      where: { userId_bookId: { userId: leo.id, bookId: thinking.id } },
      update: { status: "READING", progressPercent: 67 },
      create: { userId: leo.id, bookId: thinking.id, status: "READING", progressPercent: 67, startedAt: new Date() }
    })
  ]);

  const article = await prisma.article.upsert({
    where: { slug: "why-books-feel-like-social-objects-seed" },
    update: {
      title: "Why Books Feel Like Social Objects",
      body: "A book is not only a container of text. It is a portable conversation, a status signal, a private room, and sometimes a bridge between two people who needed the same sentence at different times.",
      excerpt: "Books are private experiences that become social through attention.",
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      tags: ["books", "culture", "ideas"],
      readingTimeMinutes: 2
    },
    create: {
      authorId: leo.id,
      slug: "why-books-feel-like-social-objects-seed",
      title: "Why Books Feel Like Social Objects",
      body: "A book is not only a container of text. It is a portable conversation, a status signal, a private room, and sometimes a bridge between two people who needed the same sentence at different times.",
      excerpt: "Books are private experiences that become social through attention.",
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      tags: ["books", "culture", "ideas"],
      readingTimeMinutes: 2
    }
  });

  const review = await upsertReview({
    authorId: anika.id,
    bookId: leftHand.id,
    title: "A cold planet, a very warm book",
    body: "Le Guin writes alienness without spectacle. The result feels less like worldbuilding trivia and more like learning to listen.",
    rating: 5,
    tags: ["science fiction", "language", "culture"]
  });

  await Promise.all([
    prisma.exploreItem.upsert({
      where: { targetType_targetId: { targetType: "ARTICLE", targetId: article.id } },
      update: { moderationStatus: "APPROVED", score: 24 },
      create: { targetType: "ARTICLE", targetId: article.id, moderationStatus: "APPROVED", score: 24 }
    }),
    prisma.exploreItem.upsert({
      where: { targetType_targetId: { targetType: "REVIEW", targetId: review.id } },
      update: { moderationStatus: "APPROVED", score: 22 },
      create: { targetType: "REVIEW", targetId: review.id, moderationStatus: "APPROVED", score: 22 }
    }),
    prisma.note.upsert({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      update: {
        selectedText: "portable conversation",
        noteText: "This is the core metaphor for Puzzle."
      },
      create: {
        id: "11111111-1111-4111-8111-111111111111",
        userId: maya.id,
        targetType: "ARTICLE",
        articleId: article.id,
        selectedText: "portable conversation",
        noteText: "This is the core metaphor for Puzzle.",
        anchorStart: 35,
        anchorEnd: 56
      }
    })
  ]);

  const story = await prisma.story.findFirst({
    where: {
      userId: leo.id,
      bookId: thinking.id,
      mediaUrl: "http://localhost:4000/media/seed/thinking-fast-and-slow.jpg"
    }
  });

  if (!story) {
    await prisma.story.create({
      data: {
        userId: leo.id,
        bookId: thinking.id,
        mediaUrl: "http://localhost:4000/media/seed/thinking-fast-and-slow.jpg",
        mediaMimeType: "image/jpeg",
        caption: "Still thinking about system 1.",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
  }

  const key = [maya.id, leo.id].sort().join(":");
  const conversation = await prisma.conversation.upsert({
    where: { directKey: key },
    update: {},
    create: {
      type: "DIRECT",
      directKey: key,
      members: {
        create: [{ userId: maya.id }, { userId: leo.id }]
      }
    }
  });

  const existingMessage = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      senderId: leo.id,
      sharedArticleId: article.id
    }
  });

  if (!existingMessage) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: leo.id,
        type: "SHARE_ARTICLE",
        body: "This is basically the thesis of the app.",
        sharedArticleId: article.id
      }
    });
  }

  console.log("Seed complete");
  console.log(`Login users with password: ${password}`);
  console.log("maya@puzzle.dev, leo@puzzle.dev, anika@puzzle.dev, mod@puzzle.dev");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
