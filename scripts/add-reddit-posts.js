const request = require('request-promise')
const connection = require('../lib/connection')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')

return connection.query('SELECT id FROM reddit_posts ORDER BY created_at DESC limit 1').then((posts) => {
  const before = posts.length > 0 ? posts[0].id : 0
  return getRedditPosts(before)
}).then((_posts) => {

  console.log(_posts.length)

  const posts = _posts.filter((post) => {
    return !post.is_self
  })

  if (posts.length === 0) {
    return
  }

  const insert_domains_q_groups = getQGroups(posts.length, 2)
  const insert_subreddits_q_groups = getQGroups(posts.length, 3)
  const insert_urls_q_groups = getQGroups(posts.length, 2, ', (SELECT id FROM domains WHERE domain = ? LIMIT 1)')
  const insert_posts_q_groups = getQGroups(posts.length, 3, ', (SELECT id FROM urls WHERE url = ? LIMIT 1)')
  const insert_domains_values = []
  const insert_subreddits_values = []
  const insert_urls_values = []
  const insert_posts_values = []

  posts.forEach((post) => {
    const domain = urljs.parse(post.url).hostname
    const subreddit_id = post.subreddit_id.split('_')[1]
    insert_domains_values.push(
      domain,
      1
    )
    insert_subreddits_values.push(
      subreddit_id,
      post.subreddit,
      1
    )
    insert_urls_values.push(
      post.url,
      1,
      domain
    )
    insert_posts_values.push(
      post.id,
      new Date(post.created_utc * 1000),
      subreddit_id,
      post.url
    )
  })

  const all_insert_values = insert_domains_values.concat(
    insert_subreddits_values
  ).concat(
    insert_urls_values
  ).concat(
    insert_posts_values
  )
  return connection.query(`
    INSERT IGNORE INTO domains(domain, reddit_posts_count) VALUES ${insert_domains_q_groups} ON DUPLICATE KEY UPDATE reddit_posts_count = reddit_posts_count + 1;
    INSERT IGNORE INTO reddit_subreddits(id, name, reddit_posts_count) VALUES ${insert_subreddits_q_groups} ON DUPLICATE KEY UPDATE reddit_posts_count = reddit_posts_count + 1;
    INSERT IGNORE INTO urls(url, reddit_posts_count, domain_id) VALUES ${insert_urls_q_groups} ON DUPLICATE KEY UPDATE reddit_posts_count = reddit_posts_count + 1;
    INSERT IGNORE INTO reddit_posts(id, created_at, subreddit_id, url_id) VALUES ${insert_posts_q_groups};
    `,
    all_insert_values
  )
}).then(() => {

}).finally(() => {
  connection.end()
})
