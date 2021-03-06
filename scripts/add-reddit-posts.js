const request = require('request-promise')
const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const _ = require('lodash')

return mysqlQuery(`
  SELECT id FROM reddit_posts ORDER BY created_at DESC limit 1;
  SELECT * FROM domains WHERE is_ignored = 0;
`).then((results) => {
  const posts = results[0]
  const nonignored_domain_pojos = results[1]

  const before = posts.length > 0 ? posts[0].id : 0
  const nonignored_domains = _.map(nonignored_domain_pojos, 'domain')

  return getRedditPosts(before).then((_posts) => {

    const posts = _posts.filter((post) => {
      return !post.is_self
    })

    const nonignored_posts = posts.filter((post) => {
      if (nonignored_domains.indexOf(post.domain) === -1) {
        return false
      } else {
        return true
      }
    })


    const insert_domains_q_groups = getQGroups(posts.length, 2)
    const insert_subreddits_q_groups = getQGroups(nonignored_posts.length, 3)
    const insert_urls_q_groups = getQGroups(nonignored_posts.length, 1, ', (SELECT id FROM domains WHERE domain = ? LIMIT 1)')
    const insert_posts_q_groups = getQGroups(nonignored_posts.length, 5, ', (SELECT id FROM urls WHERE url = ? LIMIT 1)')
    const insert_domains_values = []
    const insert_subreddits_values = []
    const insert_urls_values = []
    const insert_posts_values = []

    _.forEach(posts, (post) => {
      insert_domains_values.push(post.domain, 1)
    })


    nonignored_posts.forEach((post) => {
      const subreddit_id = post.subreddit_id.split('_')[1]
      insert_subreddits_values.push(
        subreddit_id,
        post.subreddit,
        1
      )
      console.log(post.url)
      insert_urls_values.push(
        post.url,
        post.domain
      )
      insert_posts_values.push(
        post.id,
        new Date(post.created_utc * 1000),
        subreddit_id,
        post.score,
        post.num_comments,
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

    return mysqlQuery(`
      INSERT IGNORE INTO domains(domain, reddit_posts_count) VALUES ${insert_domains_q_groups} ON DUPLICATE KEY UPDATE reddit_posts_count = reddit_posts_count + 1;
      INSERT IGNORE INTO reddit_subreddits(id, name, reddit_posts_count) VALUES ${insert_subreddits_q_groups} ON DUPLICATE KEY UPDATE reddit_posts_count = reddit_posts_count + 1;
      INSERT IGNORE INTO urls(url, domain_id) VALUES ${insert_urls_q_groups};
      INSERT IGNORE INTO reddit_posts(id, created_at, subreddit_id, score, comments_count, url_id) VALUES ${insert_posts_q_groups};
      `,
      all_insert_values
    )
  })
}).finally(() => {
  return mysqlDisconnect()
})
