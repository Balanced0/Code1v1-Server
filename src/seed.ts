import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Problem, User } from "./models.js";

const problems = [
  ["Watermelon", "Decide whether a watermelon can be split into two even positive parts.", "Easy", ["math", "implementation"], "A single integer w (1 ≤ w ≤ 100).", "8", "YES", 82],
  ["Way Too Long Words", "Abbreviate words longer than ten characters.", "Easy", ["strings", "implementation"], "Up to 100 words, each 1 to 100 characters long.", "localization", "l10n", 91],
  ["Team", "Count problems that at least two teammates are confident about.", "Easy", ["implementation"], "1 ≤ n ≤ 1000; each confidence value is 0 or 1.", "3\n1 1 0\n1 1 1\n1 0 0", "2", 88],
  ["Bit++", "Evaluate increments and decrements in a compact toy language.", "Easy", ["implementation"], "1 ≤ n ≤ 150; each operation is ++X, X++, --X, or X--.", "3\nX++\n++X\nX--", "1", 92],
  ["Beautiful Matrix", "Find the moves needed to bring the one to the center of a 5×5 matrix.", "Easy", ["implementation"], "A 5×5 matrix contains exactly one value equal to 1.", "0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 1 0\n0 0 0 0 0", "2", 90],
  ["Next Round", "Determine how many contestants advance based on score and rank.", "Easy", ["implementation", "sorting"], "2 ≤ n ≤ 50 and 1 ≤ k ≤ n.", "8 5\n10 9 8 7 7 7 5 5", "6", 86],
  ["Petya and Strings", "Compare two strings without considering letter case.", "Easy", ["strings"], "Two equal-length strings of at most 100 characters.", "aaaa\naaaA", "0", 87],
  ["Word Capitalization", "Capitalize only the first character of a word.", "Easy", ["strings"], "A non-empty lowercase or mixed-case word of at most 1000 characters.", "konjac", "Konjac", 95],
  ["Helpful Maths", "Sort the digits in a plus-separated sum.", "Easy", ["strings", "sorting"], "The expression contains digits 1, 2, and 3 only.", "3+2+1", "1+2+3", 93],
  ["Stones on the Table", "Remove the fewest stones so adjacent colors differ.", "Easy", ["greedy", "strings"], "1 ≤ n ≤ 50.", "3\nRRG", "1", 89],
  ["Presents", "Recover a permutation from the order in which gifts were given.", "Easy", ["implementation"], "1 ≤ n ≤ 100.", "4\n2 3 4 1", "4 1 2 3", 84],
  ["Queue at the School", "Simulate boys and girls swapping positions in a queue.", "Easy", ["implementation", "simulation"], "1 ≤ n, t ≤ 50.", "5 1\nBGGBG", "GBGGB", 85],
  ["Nearly Lucky Number", "Check whether the count of lucky digits is itself lucky.", "Easy", ["implementation", "number theory"], "A positive integer up to 10^18.", "40047", "YES", 80],
  ["Dubstep", "Restore words from a song where WUB marks separators.", "Easy", ["strings"], "The song is a non-empty uppercase string of at most 200 characters.", "WUBWUBABCWUB", "ABC", 88],
  ["Arrival of the General", "Move the tallest and shortest soldiers with minimum swaps.", "Easy", ["greedy", "implementation"], "2 ≤ n ≤ 100; heights are distinct.", "4\n33 44 11 22", "2", 78],
  ["Two Buttons", "Reach n from m using doubling and decrement operations.", "Medium", ["bfs", "graphs", "shortest paths"], "1 ≤ n, m ≤ 10^4.", "4 6", "2", 76],
  ["Dragon", "Defeat dragons in an order that grows your strength.", "Medium", ["greedy", "sorting"], "1 ≤ s ≤ 1000 and at most 1000 dragons.", "2 2\n1 99\n100 0", "YES", 81],
  ["T-primes", "Recognize numbers that are squares of prime numbers.", "Medium", ["number theory", "binary search"], "Up to 10^5 values, each at most 10^12.", "3\n4 5 9", "YES\nNO\nYES", 69],
  ["Little Girl and Game", "Decide the winner from character frequencies in a string game.", "Medium", ["games", "strings"], "A lowercase string of at most 100000 characters.", "aabc", "First", 74],
  ["Fox And Snake", "Print a serpent-like grid pattern.", "Easy", ["implementation"], "3 ≤ n, m ≤ 50.", "3 3", "###\n..#\n###", 90],
] as const;

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/code1v1");
  await Promise.all([Problem.deleteMany({}), User.deleteMany({})]);
  const passwordHash = await bcrypt.hash("demo12345", 12);
  const users = await User.insertMany([
    { handle: "byteblitz", email: "byteblitz@code1v1.dev", passwordHash, rating: 2184, wins: 84, losses: 22, ratingHistory: [{ date: "2026-02-01", rating: 1960 }, { date: "2026-04-01", rating: 2073 }, { date: "2026-07-01", rating: 2184 }] },
    { handle: "sana.codes", email: "sana@code1v1.dev", passwordHash, rating: 2117, wins: 72, losses: 25, ratingHistory: [{ date: "2026-02-01", rating: 1880 }, { date: "2026-04-01", rating: 2016 }, { date: "2026-07-01", rating: 2117 }] },
    { handle: "octal_fox", email: "octal@code1v1.dev", passwordHash, rating: 2063, wins: 61, losses: 21, ratingHistory: [{ date: "2026-02-01", rating: 1804 }, { date: "2026-04-01", rating: 1950 }, { date: "2026-07-01", rating: 2063 }] },
    { handle: "mira.dev", email: "mira@code1v1.dev", passwordHash, rating: 1998, wins: 55, losses: 28, ratingHistory: [{ date: "2026-02-01", rating: 1750 }, { date: "2026-04-01", rating: 1892 }, { date: "2026-07-01", rating: 1998 }] },
    { handle: "demo", email: "demo@code1v1.dev", passwordHash, rating: 1462, wins: 18, losses: 14, ratingHistory: [{ date: "2026-02-01", rating: 1200 }, { date: "2026-04-01", rating: 1327 }, { date: "2026-07-01", rating: 1462 }] },
  ]);
  await Problem.insertMany(problems.map(([title, shortDescription, difficulty, tags, constraints, sampleInput, sampleOutput, acceptanceRate], index) => ({ title, shortDescription, statement: `${title} is a classic competitive programming exercise adapted from Codeforces public problem archives. Read the input carefully and produce exactly the required output.`, difficulty, tags, constraints, sampleInput, sampleOutput, acceptanceRate, author: users[index % users.length]._id })));
  console.log(`Seeded ${users.length} players and ${problems.length} problems. Demo login: demo@code1v1.dev / demo12345`);
  await mongoose.disconnect();
}
seed().catch((error) => { console.error(error); process.exit(1); });
