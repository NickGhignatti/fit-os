import { describe, expect, it } from 'vitest';
import { mealAt, mealTimes, parseClock } from './mealTime';

const at = (h: number, m = 0) => h * 60 + m;
const usual = [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Snack' }, { name: 'Dinner' }];

describe('the meal for the time of day', () => {
  it('picks the meal closest to now', () => {
    expect(mealAt(usual, at(6))).toBe(0); // before the first meal: the first
    expect(mealAt(usual, at(10))).toBe(0); // 2 h after breakfast, 3 h before lunch
    expect(mealAt(usual, at(11))).toBe(1); // 3 h after breakfast, 2 h before lunch
    expect(mealAt(usual, at(18, 30))).toBe(3); // 2 h after the snack, 1.5 h before dinner
    expect(mealAt(usual, at(23, 30))).toBe(3); // after the last meal: the last
  });

  it('prefers the time a diet plan gives over the usual one', () => {
    expect(mealAt([{ name: 'Breakfast', time: '06:00' }, { name: 'Lunch', time: '11:30' }], at(9))).toBe(1);
  });

  it('knows Italian names, and spreads unknown ones over the day', () => {
    expect(mealTimes([{ name: 'Pranzo' }, { name: 'cena ' }])).toEqual([at(13), at(20)]);
    expect(mealTimes([{ name: 'Pasto A' }, { name: 'Pasto B' }, { name: 'Pasto C' }])).toEqual([at(8), at(14), at(20)]);
    expect(mealTimes([{ name: 'Only one' }])).toEqual([at(13)]);
  });

  it('reads clock times and refuses anything else', () => {
    expect(parseClock('8.30')).toBe(at(8, 30));
    expect(parseClock(' 20:05 ')).toBe(at(20, 5));
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('soon')).toBeNull();
  });
});
