export const nowISO = () => new Date().toISOString();

export const addHours = (hours) =>
  new Date(Date.now() + hours * 3600 * 1000).toISOString();
