import type { LocalDate } from '../domain/plan';

/** Lines for a day with no training, one a day, all about why resting is part of the work. */
export const REST_QUOTES: readonly string[] = [
  'Muscles are torn in the gym and built on the couch. Today you build.',
  'Rest is not a break from training. It is the part where training pays off.',
  'You do not grow while you lift. You grow while you recover.',
  'Strong people know when to stop. Today, stop.',
  'A rested body lifts more tomorrow than a tired one lifts today.',
  'Recovery is a skill. Practise it as hard as you practise squats.',
  'Sleep well tonight: it is the best supplement there is.',
  'The plan says rest. Trust the plan.',
  'Rest days keep the good days coming.',
  'Your joints and tendons heal slower than your muscles. Give them today.',
  'No sets today, and that is the set that matters most.',
  'Progress is lift, eat, sleep, repeat. Today is the sleep part.',
  'Even the best engines need to cool down.',
  'Skipping rest is how good months turn into injured ones.',
  'Fatigue hides fitness. Rest lets it show.',
  'Today you do not earn it. Today you keep it.',
  'Walk a little, stretch a little, and let the rest do its work.',
  'Champions rest on purpose.',
  'One easy day now saves you a forced week off later.',
  'The body adapts between workouts, not during them.',
  'Drink water, eat well, put your feet up. That is training too.',
  'A bow that is always drawn loses its spring.',
  'Rest now, and come back hungry.',
  'Your next personal record starts with tonight’s sleep.',
  'Doing nothing today is doing something for tomorrow.',
  'Muscle is built from food and rest. You already did the hard part.',
  'Listen to your body today. It has been listening to you all week.',
  'Discipline is also knowing when not to train.',
  'Recovered beats exhausted, every single time.',
  'Fields left fallow grow back richer.',
  'Enjoy the day off. You worked for it.',
  'The weights will still be there tomorrow. So will you, stronger.',
  'Rest is where the effort becomes strength.',
  'Take a slow walk. Breathe. Let your nervous system reset.',
  'Overtraining is not dedication. Rest is.',
  'Today your only rep is a good night’s sleep.',
  'Be lazy on purpose today. It is in the plan.',
  'Small aches heal on rest days, before they become big ones.',
  'Recovery is not weakness leaving the body. It is strength arriving.',
  'You trained hard. Now let it settle in.',
  'Give your heart rate a holiday.',
  'A rest day is a deposit, not a withdrawal.',
  'Stretch, foam roll, relax. Your future self says thanks.',
  'Hard work needs a soft day to stick.',
  'Rest well and the next session will feel lighter.',
  'The strongest move today is staying on the sofa.',
  'Rest is the quiet half of every workout.',
  'You cannot pour from an empty cup. Fill it up today.',
  'Patience builds more muscle than panic.',
  'Today, recovery is the workout.',
  'Let the soreness fade. That is the sound of you getting stronger.',
  'Good training is a rhythm: push, rest, push. This is the rest.',
  'Eat your protein, get your sleep, enjoy your day.',
  'Momentum is not lost in a day. It is lost in burnout.',
  'Rest is part of the program, not a pause in it.',
  'Recharge today so you can go all out tomorrow.',
  'A calm day today makes a heavy bar feel lighter tomorrow.',
  'Take the day. You have nothing to prove to the gym.',
  'Recovery days are where consistency is protected.',
  'Feet up, phone down, lights out early.',
  'Growth needs time. Give it some today.',
];

/**
 * How far the quote moves on each day. It shares no factor with the list length, so the order
 * looks shuffled yet every quote comes up once before any repeats.
 */
const STEP = 23;

/** The quote for [date]: the same all day, a different one the next. */
export const restQuoteFor = (date: LocalDate): string => {
  const day = Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  const n = REST_QUOTES.length;
  return REST_QUOTES[(((day * STEP) % n) + n) % n]!;
};
