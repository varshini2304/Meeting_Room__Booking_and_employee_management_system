const pad = (n) => String(n).padStart(2, "0");

export const generateSlots = (startHour = 8, endHour = 20) => {
  const slots = [];
  for (let h = startHour; h < endHour; h += 1) {
    slots.push(`${pad(h)}:00`);
    slots.push(`${pad(h)}:30`);
  }
  return slots;
};

export const addThirtyMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m + 30);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isValidHalfHourSlot = (time) => /^\d{2}:(00|30)$/.test(time);

