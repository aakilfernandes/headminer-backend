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
  SELECT * FROM urls
  ORDER BY reddit_counts_add_priority DESC, reddit_counts_added_at ASC
  LIMIT 10
`).then((url_pojos) => {
  const url_ids = _.map(url_pojos, 'id')
  console.log(url_ids)
  const url_ids_qs = getQs(url_ids.length)
  return mysqlQuery(`
    UPDATE urls SET reddit_counts_add_priority = 0, reddit_counts_added_at = NOW()
      WHERE id IN (${url_ids_qs});
    SELECT * FROM reddit_posts WHERE url_id IN (${url_ids_qs})
  `, url_ids.concat(url_ids)).then((results) => {
    const posts = results[1]
    const queries = []
    const values = []

    const fetches = posts.map((post) => {
      return function fetch() {
        const api_url = `https://www.reddit.com/r/all/comments/${post.id}.json`
        return request(api_url).then((body) => {
          const data = JSON.parse(body)[0].data.children[0].data
          const score = data.score
          const comments_count = data.num_comments

          queries.push(`
            UPDATE reddit_posts
              SET score = ?, comments_count = ?
              WHERE id = ?;

          `)
          values.push(
            score, comments_count, post.id
          )
        })
      }
    })

    const article_ids = _.uniq(_.map(url_pojos, 'article_id'))
    const article_ids_qs = getQs(article_ids.length)
    queries.push(`
      UPDATE articles SET is_reddit_coallescable = 1 WHERE id IN (${article_ids_qs});
    `)
    values.push(...article_ids)

    return waterfall(fetches).then(() => {
      return mysqlQuery(queries.join('\r\n'), values)
    })
  })
}).finally(() => {
  return mysqlDisconnect()
})
