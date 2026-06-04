import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export interface BookCandidate {
  source: "GOOGLE_BOOKS" | "OPEN_LIBRARY";
  googleBooksId?: string;
  openLibraryKey?: string;
  isbn10?: string;
  isbn13?: string;
  title: string;
  subtitle?: string;
  authors: string[];
  description?: string;
  thumbnailUrl?: string;
  language?: string;
  publishedDate?: string;
  publisher?: string;
  pageCount?: number;
  categories: string[];
  rawJson: unknown;
}

function firstIsbn(identifiers: Array<{ type?: string; identifier?: string }> | undefined, type: string) {
  return identifiers?.find((identifier) => identifier.type === type)?.identifier;
}

function normalizeGoogleVolume(item: any): BookCandidate {
  const volume = item.volumeInfo ?? {};
  return {
    source: "GOOGLE_BOOKS",
    googleBooksId: item.id,
    isbn10: firstIsbn(volume.industryIdentifiers, "ISBN_10"),
    isbn13: firstIsbn(volume.industryIdentifiers, "ISBN_13"),
    title: volume.title ?? "Untitled",
    subtitle: volume.subtitle,
    authors: volume.authors ?? [],
    description: volume.description,
    thumbnailUrl: volume.imageLinks?.thumbnail?.replace("http://", "https://"),
    language: volume.language,
    publishedDate: volume.publishedDate,
    publisher: volume.publisher,
    pageCount: volume.pageCount,
    categories: volume.categories ?? [],
    rawJson: item
  };
}

function normalizeOpenLibraryDoc(item: any): BookCandidate {
  const isbn = Array.isArray(item.isbn) ? item.isbn : [];
  const isbn13 = isbn.find((value: string) => value.length === 13);
  const isbn10 = isbn.find((value: string) => value.length === 10);
  const coverId = item.cover_i;

  return {
    source: "OPEN_LIBRARY",
    openLibraryKey: item.key,
    isbn10,
    isbn13,
    title: item.title ?? "Untitled",
    authors: item.author_name ?? [],
    description: item.first_sentence?.[0],
    thumbnailUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
    language: item.language?.[0],
    publishedDate: item.first_publish_year ? String(item.first_publish_year) : undefined,
    publisher: item.publisher?.[0],
    pageCount: item.number_of_pages_median,
    categories: item.subject?.slice(0, 12) ?? [],
    rawJson: item
  };
}

function googleBooksUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/books/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", env.GOOGLE_BOOKS_API_KEY);
  }
  return url;
}

export async function searchBookCandidates(query: string): Promise<BookCandidate[]> {
  const googleUrl = googleBooksUrl("volumes", {
    q: query,
    maxResults: "10",
    printType: "books"
  });

  const googleResponse = await fetch(googleUrl);
  const googleJson: any = googleResponse.ok ? await googleResponse.json() : { items: [] };
  const googleBooks = (googleJson.items ?? []).map(normalizeGoogleVolume);

  if (googleBooks.length >= 5) {
    return googleBooks;
  }

  const openLibraryUrl = new URL(`${env.OPEN_LIBRARY_BASE_URL}/search.json`);
  openLibraryUrl.searchParams.set("q", query);
  openLibraryUrl.searchParams.set("limit", "10");
  const openLibraryResponse = await fetch(openLibraryUrl);
  const openLibraryJson: any = openLibraryResponse.ok ? await openLibraryResponse.json() : { docs: [] };
  const openLibraryBooks = (openLibraryJson.docs ?? []).map(normalizeOpenLibraryDoc);

  const seen = new Set<string>();
  return [...googleBooks, ...openLibraryBooks].filter((book) => {
    const key = book.isbn13 ?? book.googleBooksId ?? book.openLibraryKey ?? book.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function getGoogleBookById(id: string): Promise<BookCandidate | null> {
  const response = await fetch(googleBooksUrl(`volumes/${id}`, {}));
  if (!response.ok) {
    return null;
  }
  return normalizeGoogleVolume(await response.json());
}

export async function getBookByIsbn(isbn: string): Promise<BookCandidate | null> {
  const [candidate] = await searchBookCandidates(`isbn:${isbn}`);
  return candidate ?? null;
}

export async function getOpenLibraryBook(key: string): Promise<BookCandidate | null> {
  const searchKey = key.replace(/^\/?works\//, "");
  const url = new URL(`${env.OPEN_LIBRARY_BASE_URL}/search.json`);
  url.searchParams.set("q", searchKey);
  url.searchParams.set("limit", "1");
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const json: any = await response.json();
  const [doc] = json.docs ?? [];
  return doc ? normalizeOpenLibraryDoc(doc) : null;
}

export async function upsertBook(app: FastifyInstance, candidate: BookCandidate) {
  const existing = await app.prisma.book.findFirst({
    where: {
      OR: [
        ...(candidate.googleBooksId ? [{ googleBooksId: candidate.googleBooksId }] : []),
        ...(candidate.openLibraryKey ? [{ openLibraryKey: candidate.openLibraryKey }] : []),
        ...(candidate.isbn13 ? [{ isbn13: candidate.isbn13 }] : [])
      ]
    }
  });

  const data = {
    googleBooksId: candidate.googleBooksId,
    openLibraryKey: candidate.openLibraryKey,
    isbn10: candidate.isbn10,
    isbn13: candidate.isbn13,
    title: candidate.title,
    subtitle: candidate.subtitle,
    authors: candidate.authors,
    description: candidate.description,
    thumbnailUrl: candidate.thumbnailUrl,
    language: candidate.language,
    publishedDate: candidate.publishedDate,
    publisher: candidate.publisher,
    pageCount: candidate.pageCount,
    categories: candidate.categories,
    source: candidate.source,
    rawJson: candidate.rawJson as any
  };

  if (existing) {
    return app.prisma.book.update({
      where: { id: existing.id },
      data
    });
  }

  return app.prisma.book.create({ data });
}
