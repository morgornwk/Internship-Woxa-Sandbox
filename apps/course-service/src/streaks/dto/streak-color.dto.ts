export type StreakColor = 'yellow' | 'orange' | 'red' | 'pink' | 'purple';

export const getStreakColor = (days: number): StreakColor | null => {
  if (days >= 200) return 'purple';
  if (days >= 100) return 'pink';
  if (days >= 30) return 'red';
  if (days >= 10) return 'orange';
  if (days >= 3) return 'yellow';
  return null;
};
