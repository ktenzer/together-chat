export interface DemoImage {
  filename: string;
  category: 'business' | 'science';
  description: string; // A brief description for context
}

const demoImages: DemoImage[] = [
  { filename: 'business-meeting.jpg', category: 'business', description: 'A group of professionals in a business meeting discussing strategy.' },
  { filename: 'laboratory-research.jpg', category: 'science', description: 'Scientists working in a laboratory with advanced equipment.' },
  { filename: 'data-analytics.jpg', category: 'business', description: 'A dashboard displaying various data analytics and charts.' },
  { filename: 'dna-structure.jpg', category: 'science', description: 'A visual representation of a DNA double helix structure.' },
  { filename: 'office-collaboration.jpg', category: 'business', description: 'Team members collaborating in a modern office environment.' },
  { filename: 'microscope-research.jpg', category: 'science', description: 'A researcher using a high-powered microscope for analysis.' },
  { filename: 'financial-charts.jpg', category: 'business', description: 'Financial charts and graphs displayed on computer screens.' },
  { filename: 'solar-panels.jpg', category: 'science', description: 'Solar panels arranged in a field for renewable energy generation.' },
  { filename: 'team-presentation.jpg', category: 'business', description: 'A professional giving a presentation to a team in a conference room.' },
  { filename: 'chemical-experiment.jpg', category: 'science', description: 'A scientist conducting a chemical experiment with test tubes.' },
  { filename: 'startup-workspace.jpg', category: 'business', description: 'A modern startup workspace with employees working on laptops.' },
  { filename: 'telescope-observation.jpg', category: 'science', description: 'An astronomer using a telescope for celestial observations.' },
];

export const getRandomDemoImage = (): DemoImage => {
  const randomIndex = Math.floor(Math.random() * demoImages.length);
  return demoImages[randomIndex];
};

export const getDemoImageUrl = (filename: string): string => {
  return `/demo-images/${filename}`;
};
