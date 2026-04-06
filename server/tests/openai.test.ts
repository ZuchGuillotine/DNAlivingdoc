import { chatWithAI, MODELS, estimateTokenCount } from '../openai';

describe('OpenAI integration surface', () => {
  test('chatWithAI streams deterministic mocked chunks', async () => {
    const messages = [{ role: 'user', content: 'Hello, how are you?' }];

    const generator = chatWithAI(messages);
    let fullResponse = '';

    for await (const chunk of generator) {
      expect(chunk).toHaveProperty('response');
      expect(chunk).toHaveProperty('streaming');

      if (chunk.response) {
        fullResponse += chunk.response;
      }
    }

    expect(fullResponse).toBe('This is a test.');
  });

  test('chatWithAI accepts model override', async () => {
    const messages = [{ role: 'user', content: 'Tell me about supplements' }];

    const generator = chatWithAI(messages, MODELS.QUERY_CHAT);
    let received = false;

    for await (const _chunk of generator) {
      received = true;
      break;
    }

    expect(received).toBe(true);
  });

  test('token estimation scales by content length', () => {
    const shortText = 'Brief supplement summary';
    const mediumText = 'Vitamin D3 is essential for calcium absorption and bone health.';
    const longText =
      'Magnesium is involved in over 300 enzymatic reactions and supports muscle, sleep, and energy regulation.';

    const shortTokens = estimateTokenCount(shortText);
    const mediumTokens = estimateTokenCount(mediumText);
    const longTokens = estimateTokenCount(longText);

    expect(shortTokens).toBeLessThan(mediumTokens);
    expect(mediumTokens).toBeLessThan(longTokens);
  });
});
