/** "Good morning/afternoon/evening, <first name>" from the signed-in employee (GET /auth/me) and the local clock. */
export function greeting(fullName: string | undefined, now = new Date()) {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
