export interface DemoImage {
  filename: string;
}

// Cache for demo images
let cachedImages: string[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

export const fetchDemoImages = async (): Promise<string[]> => {
  // Return cached images if still valid
  const now = Date.now();
  if (cachedImages.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedImages;
  }
  
  try {
    const response = await fetch('http://localhost:3001/api/demo-images');
    const data = await response.json();
    cachedImages = data.images || [];
    lastFetchTime = now;
    return cachedImages;
  } catch (error) {
    console.error('Error fetching demo images:', error);
    // Return cached images if available, otherwise empty array
    return cachedImages;
  }
};

export const getRandomDemoImage = async (): Promise<string | null> => {
  const images = await fetchDemoImages();
  if (images.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
};

export const getDemoImageUrl = (filename: string): string => {
  return `/demo-images/${filename}`;
};
