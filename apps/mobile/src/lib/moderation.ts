import { Alert } from 'react-native';

import { api } from './api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Target = 'USER' | 'ARTICLE' | 'COMMENT' | 'STORY' | 'MESSAGE';
const REASONS: { label: string; reason: string }[] = [
  { label: 'Spam', reason: 'SPAM' },
  { label: 'Harassment or hate', reason: 'HARASSMENT' },
  { label: 'Nudity or sexual content', reason: 'SEXUAL_CONTENT' },
  { label: 'False information', reason: 'MISINFORMATION' },
  { label: 'Something else', reason: 'OTHER' },
];

/** Not designed: "Report" asks why (system sheet), sends it, and thanks; mock content only thanks. */
export function report(targetType: Target, targetId: string) {
  Alert.alert('Report', 'Why are you reporting this?', [
    ...REASONS.map((r) => ({
      text: r.label,
      onPress: () => {
        const done = () => Alert.alert('Thanks for letting us know', 'We will review it shortly.');
        if (!UUID.test(targetId)) return done();
        api('/reports', { body: { targetType, targetId, reason: r.reason }, auth: true })
          .then(done)
          .catch(() => Alert.alert("Couldn't send the report", 'Check the connection and try again.'));
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/** Block (asks first) / unblock; resolves with the new state. */
export function setBlocked(userId: string, username: string, block: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const run = () =>
      api(`/users/${userId}/block`, { method: block ? 'POST' : 'DELETE', auth: true })
        .then(() => resolve(block))
        .catch(() => {
          Alert.alert(block ? "Couldn't block" : "Couldn't unblock", 'Check the connection and try again.');
          resolve(!block);
        });
    if (!block) return run();
    Alert.alert(`Block ${username}?`, "They won't be able to find your profile, posts or stories, or message you.", [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Block', style: 'destructive', onPress: run },
    ]);
  });
}

/** Deletes an own post after asking. */
export function deletePost(articleId: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Delete this post?', 'It will disappear from your profile and the feed.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          api(`/articles/${articleId}`, { method: 'DELETE', auth: true })
            .then(() => resolve(true))
            .catch(() => {
              Alert.alert("Couldn't delete", 'Check the connection and try again.');
              resolve(false);
            }),
      },
    ]);
  });
}
