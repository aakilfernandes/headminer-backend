const second_ms = 1000
const minute_ms = 60 * second_ms
const hour_ms = 60 * minute_ms

module.exports = {
  'update-processing-priorities': {
    target_ms: minute_ms
  },
  'add-reddit-posts': {
    target_ms: minute_ms
  },
  'delete-ignored-urls': {
    target_ms: hour_ms
  },
  'delete-old-jobs': {
    target_ms: hour_ms
  },
  'add-article-snapshots': {
    target_ms: hour_ms
  },
  'update-average-twitter-influences': {
    target_ms: hour_ms
  },
  'add-twitter-statuses': {
    wait_ms: 10 * second_ms,
    api: {
      name: 'twitter-search',
      window_ms: 15 * minute_ms
    }
  },
  'add-twitter-friends': {
    wait_ms: 10 * second_ms,
    api: {
      name: 'twitter-friend-ids',
      window_ms: 15 * minute_ms
    }
  },
  'add-facebook-counts': {
    wait_ms: 10 * second_ms,
    api: {
      name: 'facebook',
      window_ms: 10 * minute_ms
    }
  },
  'twitter-influencify-urls': {
    wait_ms: 10 * second_ms
  }
}
