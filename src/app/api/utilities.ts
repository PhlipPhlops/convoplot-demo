
export function estimateTokens(text: string): number {
    // Remove extra whitespace and split into words
    const words = text.trim().split(/\s+/);
    const charCount = text.length;
    
    // Estimate based on character count (1 token ~= 4 chars)
    const tokensByChar = Math.ceil(charCount / 4);
    
    // Estimate based on word count (1 token ~= 3/4 words)
    const tokensByWord = Math.ceil(words.length * 0.75);
    
    // Use the higher estimate to err on the side of caution
    return Math.max(tokensByChar, tokensByWord);
}