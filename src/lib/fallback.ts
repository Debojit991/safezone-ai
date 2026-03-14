export const loadFallback = async (clip: string) => {
  const fileVersion = Math.random() > 0.5 ? '01' : '02';
  const filePath = `/fallbacks/${clip}_${fileVersion}.json`;

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading fallback JSON:', error);
    return null;
  }
};
