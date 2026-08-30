// Mock pour @google/genai - À remplacer par: npm install @google/genai
export const generateText = async (_prompt: string) => ({ text: '' });
export const generateContent = async (_prompt: string) => ({ text: '' });
export default { generateText, generateContent };
