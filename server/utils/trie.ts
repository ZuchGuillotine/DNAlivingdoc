import { SelectSupplementReference } from "@db/schema";

/**
 * TrieNode class represents a node in the Trie data structure
 * Used for efficient prefix-based searching of supplement names
 */
class TrieNode {
  children: Map<string, TrieNode>;     // Maps characters to child nodes
  isEndOfWord: boolean;                // Marks if this node represents a complete word
  data: SelectSupplementReference | null; // Stores supplement data at complete words

  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.data = null;
  }
}

/**
 * Calculates the Levenshtein distance between two strings
 * Used for fuzzy matching when exact matches aren't found
 * 
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @returns Number representing the edit distance between strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,  // substitution
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1       // insertion
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Normalizes vitamin and supplement names for consistent searching
 * Handles common misspellings and variations in supplement names
 * 
 * @param input Raw supplement name input
 * @returns Normalized string for consistent matching
 */
function normalizeVitaminName(input: string): string {
  if (!input) return '';

  // Remove spaces and convert to lowercase
  let normalized = input.toLowerCase().replace(/\s+/g, '');

  // Common vitamin spelling patterns
  normalized = normalized
    .replace(/vit+a*min/g, 'vitamin')  // Handle repeated letters
    .replace(/vitamiin/g, 'vitamin')
    .replace(/vitmin/g, 'vitamin')
    .replace(/vitamen/g, 'vitamin')
    .replace(/vitemin/g, 'vitamin');

  return normalized;
}

/**
 * Trie data structure implementation for efficient supplement name searching
 * Provides both exact prefix matching and fuzzy matching capabilities
 */
export class Trie {
  private root: TrieNode;
  private supplements: Map<string, SelectSupplementReference>;
  private baseMaxDistance: number = 2;  // Base Levenshtein distance for fuzzy matching

  constructor() {
    this.root = new TrieNode();
    this.supplements = new Map();
  }

  /**
   * Determines maximum allowed edit distance based on word length
   * Longer words allow for more variations in spelling
   */
  private getMaxDistance(wordLength: number): number {
    if (wordLength <= 4) return this.baseMaxDistance;
    if (wordLength <= 8) return this.baseMaxDistance + 1;
    return this.baseMaxDistance + 2;
  }

  /**
   * Inserts a supplement into the Trie
   * @param word Supplement name
   * @param data Complete supplement reference data
   */
  insert(word: string, data: SelectSupplementReference) {
    if (!word || !data) {
      console.warn('Attempted to insert invalid data into Trie:', { word, data });
      return;
    }

    let current = this.root;
    const normalizedWord = normalizeVitaminName(word);

    for (const char of normalizedWord) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }

    current.isEndOfWord = true;
    current.data = data;
    this.supplements.set(normalizedWord, data);
  }

  /**
   * Searches for supplements by prefix with fuzzy matching fallback
   * @param prefix Search prefix
   * @param limit Maximum number of results to return
   * @returns Array of matching supplement references
   */
  search(prefix: string, limit: number = 4): SelectSupplementReference[] {
    const results: SelectSupplementReference[] = [];
    if (!prefix) {
      console.log('Empty search prefix provided');
      return results;
    }

    const normalizedPrefix = normalizeVitaminName(prefix);
    console.log(`Searching trie for normalized prefix: "${normalizedPrefix}"`);

    // First try exact prefix match
    let current = this.root;
    let exactMatch = true;

    for (const char of normalizedPrefix) {
      if (!current.children.has(char)) {
        exactMatch = false;
        break;
      }
      current = current.children.get(char)!;
    }

    if (exactMatch) {
      this._findAllWords(current, normalizedPrefix, results, limit);
    }

    // If no exact matches or not enough results, try fuzzy matching
    if (results.length < limit) {
      console.log('No exact matches found, trying fuzzy search');
      const fuzzyResults = this._fuzzySearch(normalizedPrefix, limit - results.length);
      results.push(...fuzzyResults);
    }

    console.log(`Found ${results.length} matches in Trie:`, results);
    return results;
  }

  /**
   * Performs fuzzy matching using Levenshtein distance
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Array of fuzzy-matched supplements
   */
  private _fuzzySearch(query: string, limit: number): SelectSupplementReference[] {
    const results: SelectSupplementReference[] = [];
    const matches = new Map<string, { distance: number; data: SelectSupplementReference }>();
    const maxDistance = this.getMaxDistance(query.length);

    // Compare with all stored supplements
    this.supplements.forEach((data, word) => {
      const distance = levenshteinDistance(query, word);
      if (distance <= maxDistance) {
        matches.set(word, { distance, data });
      }
    });

    // Sort matches by distance and take the top results
    const sortedMatches = Array.from(matches.entries())
      .sort((a, b) => a[1].distance - b[1].distance)
      .slice(0, limit);

    for (const [_, { data }] of sortedMatches) {
      if (data) results.push(data);
    }

    return results;
  }

  /**
   * Recursively finds all words in the Trie starting from a given node
   * Used for collecting all matches for a prefix
   */
  private _findAllWords(
    node: TrieNode, 
    prefix: string, 
    results: SelectSupplementReference[], 
    limit: number
  ) {
    if (results.length >= limit) return;

    if (node.isEndOfWord && node.data) {
      console.log(`Adding word to results: ${prefix}`);
      results.push(node.data);
    }

    node.children.forEach((childNode, char) => {
      this._findAllWords(childNode, prefix + char, results, limit);
    });
  }

  /**
   * Bulk loads supplements into the Trie
   * @param supplements Array of supplement references to load
   */
  loadSupplements(supplements: SelectSupplementReference[]) {
    if (!Array.isArray(supplements)) {
      console.error('Invalid supplements data provided to loadSupplements');
      return;
    }

    console.log(`Loading ${supplements.length} supplements into trie`);

    for (const supplement of supplements) {
      if (supplement && supplement.name) {
        console.log(`Adding supplement: ${supplement.name}`);
        this.insert(supplement.name, supplement);
      } else {
        console.warn('Invalid supplement data:', supplement);
      }
    }

    console.log('Finished loading supplements into trie');
  }
}