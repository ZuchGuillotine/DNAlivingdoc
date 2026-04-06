import React from 'react';

const phrases = [
  "Should I cycle L-Tyrosine?",
  "Which supplements help with muscle soreness?",
  "Is magnesium citrate different from glycinate?",
  "How can I improve my sleep?",
  "How much creatine is the right amount?",
  "Foods or supplements for vitamin D deficiency?",
  "What's a good zinc dosage for immunity?",
  "Are there benefits to ashwagandha supplements?",
  "Can fish oil help with joint health?",
  "What's the ideal B-complex ratio?",
  "Iron supplement timing for best absorption?",
  "Are probiotics beneficial for gut health?",
  "Should I consider cycling caffeine intake?",
  "What's the difference between fish collagen and bovine collagen?",
  "Is vitamin K2 necessary when taking higher doses of vitamin D?",
  "Are adaptogens safe for daily, long-term use?",
  "Does melatonin dosage vary with age for better sleep?",
  "Can alpha-lipoic acid help regulate blood sugar levels?",
  "How can I gauge the quality of my probiotic supplement?",
  "Should I combine vitamin C with iron for enhanced absorption?",
  "How do I safely transition from synthetic to natural supplements?",
  "Can supplementing with L-arginine improve workout performance?",
  "What are the potential side effects of too much vitamin A?",
  "Is there an optimal ratio of EPA to DHA in fish oil supplements?"
];

interface BackgroundWordsProps {
  className?: string;
}

export const BackgroundWords: React.FC<BackgroundWordsProps> = ({ className = '' }) => {
  const createRows = () => {
    // Create more rows to cover the entire page height
    const numRows = 12; // Increased number of rows
    const rows: string[] = [];
    
    for (let i = 0; i < numRows; i++) {
      // Shuffle phrases for each row to get variation
      const shuffled = [...phrases].sort(() => Math.random() - 0.5);
      const phrasesInRow = 2 + (i % 2);
      const rowPhrases = shuffled.slice(0, phrasesInRow);
      const combinedPhrase = rowPhrases.join('                •                ');
      rows.push(combinedPhrase);
    }

    return rows;
  };

  return (
    <div className={`background-words-container ${className}`}>
      {createRows().map((row, rowIndex) => {
        const direction = rowIndex % 2 === 0 ? 'right-to-left' : 'left-to-right';
        const size = rowIndex % 3 === 0 ? 'large' : rowIndex % 3 === 1 ? 'medium' : 'small';

        return (
          <div key={rowIndex} className="word-row">
            <div
              className={`word-line ${size} ${direction}`}
              style={{
                animationDelay: `${-(rowIndex * 20)}s`, 
              }}
            >
              {row}
            </div>
            <div
              className={`word-line ${size} ${direction}`}
              style={{
                animationDelay: `${-(rowIndex * 20 + 60)}s`, 
              }}
            >
              {row}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BackgroundWords;