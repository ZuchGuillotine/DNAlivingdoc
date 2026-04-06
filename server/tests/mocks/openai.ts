export default class OpenAI {
  chat = {
    completions: {
      create: jest.fn().mockImplementation(({ stream }: { stream?: boolean } = {}) => {
        if (stream) {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield {
                choices: [{ delta: { content: 'This ' }, index: 0 }],
              };
              yield {
                choices: [{ delta: { content: 'is a ' }, index: 0 }],
              };
              yield {
                choices: [{ delta: { content: 'test.' }, index: 0 }],
              };
            },
          };
        }
        return Promise.resolve({
          choices: [{ message: { content: 'This is a test response' } }],
        });
      }),
    },
  };

  embeddings = {
    create: jest.fn().mockResolvedValue({
      data: [
        {
          embedding: new Array(1536).fill(0.1),
        },
      ],
    }),
  };

  constructor(_config?: any) {}
}
