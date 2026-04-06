import { embeddingService } from '../services/embeddingService';
import { db } from '../../db';

jest.mock('../../db', () => ({
  // Return a chainable Drizzle-like builder for the methods used in tests.
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 1 }])
      })
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        const builder: any = {};
        builder.where = jest.fn().mockReturnValue(builder);
        builder.orderBy = jest.fn().mockReturnValue(builder);
        builder.limit = jest.fn().mockResolvedValue([]);
        return builder;
      })
    }),
    execute: jest.fn().mockResolvedValue({ rows: [] })
  }
}));

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generateEmbedding returns an embedding array', async () => {
    const text = 'This is a test text for embedding';
    const embedding = await embeddingService.generateEmbedding(text);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536);
  });

  test('generateEmbedding caches repeated calls', async () => {
    const text = 'Cache test text for embedding';
    const embedding1 = await embeddingService.generateEmbedding(text);
    const embedding2 = await embeddingService.generateEmbedding(text);

    expect(embedding1).toEqual(embedding2);
  });

  test('createLogEmbedding stores an embedding', async () => {
    const logId = 1;
    const content = 'Test log content';

    await embeddingService.createLogEmbedding(logId, content, 'qualitative');

    expect((db.insert as jest.Mock)).toHaveBeenCalled();
  });

  test('findSimilarContent returns an array', async () => {
    const results = await embeddingService.findSimilarContent('Test query', 1);
    expect(Array.isArray(results)).toBe(true);
  });

  test('findSimilarContent handles vector search errors', async () => {
    (db.execute as jest.Mock).mockRejectedValueOnce(new Error('vector search failed'));

    const results = await embeddingService.findSimilarContent('Fallback query', 1);
    expect(Array.isArray(results)).toBe(true);
  });
});
