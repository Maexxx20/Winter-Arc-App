import type de from '../de/progress';
import type { DictOf } from '../../types';

const progress: DictOf<typeof de> = {
  title: 'Before / after',
  intro: 'Add photos to your journal – ideally once a week, same pose, same light. Here you compare two of them and watch the time-lapse.',
  private: 'Only for you – your crew never sees journal photos.',
  addToday: 'Add a photo to today',
  allArcs: 'All arcs',
  count: { one: '{count} photo', other: '{count} photos' },
  compare: 'Comparison',
  before: 'Before',
  after: 'After',
  between: { one: '{count} day apart', other: '{count} days apart' },
  pickHint: 'Tap a photo below to pick it as before or after.',
  setBefore: 'As before',
  setAfter: 'As after',
  openDay: 'Open day',
  dragHint: 'Drag to compare',
  timelapse: 'Time-lapse',
  play: '▶ Play',
  stop: '■ Stop',
  shareCompare: 'Share comparison',
  shareTitle: 'Before / after',
  shareNote: 'Sharing is up to you – the image only leaves your phone if you send it.',
  all: 'All photos',
  open: 'Before / after',
};

export default progress;
