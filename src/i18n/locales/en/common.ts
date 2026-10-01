import type de from '../de/common';
import type { DictOf } from '../../types';

const common: DictOf<typeof de> = {
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  delete: 'Delete',
  remove: 'Remove',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  edit: 'Edit',
  share: 'Share',
  retry: 'Try again',
  loading: 'Loading …',
  ok: 'OK',
  yes: 'Yes',
  no: 'No',
  later: 'Later',
  error: 'Error',
  offline: 'No connection. Are you online?',
  signInFirst: 'Please sign in first.',
  someone: 'Someone',
  noName: 'No name',
  days: { one: '{count} day', other: '{count} days' },
};
export default common;
