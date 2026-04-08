export interface Sticker {
  name: string;
  imageUrl: string;
  placeholderGradient: string;
}

const countryNames = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
];

const placeholderGradient =
  'radial-gradient(24% 24% at 50% 50%, #6366f1f0 0%, #6366f185 36%, #00000000 78%),radial-gradient(26% 26% at 30% 30%, #8b5cf6f0 0%, #8b5cf685 36%, #00000000 78%),radial-gradient(26% 26% at 70% 70%, #a78bfaf0 0%, #a78bfa85 36%, #00000000 78%),radial-gradient(28% 28% at 50% 50%, #7c3aedf0 0%, #7c3aed85 36%, #00000000 78%)';

const placeholderImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%236366f1'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='white' font-size='40'%3E%F0%9F%8C%8D%3C/text%3E%3C/svg%3E";

export const stickers: Sticker[] = countryNames.map((name) => ({
  name,
  imageUrl: placeholderImage,
  placeholderGradient,
}));
