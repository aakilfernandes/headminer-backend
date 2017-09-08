const request = require('request-promise')
const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')
const waterfall = require('promise-waterfall')
const _ = require('lodash')
const getQs = require('../lib/getQs')

return mysqlQuery(`
  SELECT reddit_posts.* FROM reddit_posts, urls, domains
    WHERE reddit_posts.url_id = urls.id
      AND urls.domain_id = domains.id
      AND domains.is_ignored = 0
      AND reddit_posts.created_at > NOW() - INTERVAL 48 HOUR
    ORDER BY snapshot_added_at ASC LIMIT 10;
`).then((posts) => {

  const post_ids = _.map(posts, 'id')
  const post_ids_qs = getQs(post_ids.length)

  return mysqlQuery(`
    UPDATE reddit_posts SET snapshot_added_at = NOW() WHERE id IN (${post_ids_qs})
  `, post_ids).then(() => {

    const bodies = []

    const fetches = posts.map((post) => {
      return function fetch() {
        const api_url = `https://www.reddit.com/r/all/comments/${post.id}.json`
        return request(api_url).then((body) => {
          bodies.push(body)
        })
      }
    })

    return waterfall(fetches).then(() => {

      const queries = []
      const values = []

      bodies.forEach((body, index) => {
        const data = JSON.parse(body)[0].data.children[0].data
        const score = data.score
        const comments_count = data.num_comments
        const post = posts[index]

        queries.push(`
          UPDATE reddit_posts
            SET score = ?, comments_count = ?
            WHERE id = ?;
          INSERT INTO reddit_post_snapshots(post_id, score, comments_count)
            VALUES(?, ?, ?);
        `)
        values.push(
          score, comments_count, post.id,
          post.id, score, comments_count
        )
      })

      const query = queries.join('\r\n')

      return mysqlQuery(query, values)
    })

  })

}).finally(() => {
  return mysqlDisconnect()
})
