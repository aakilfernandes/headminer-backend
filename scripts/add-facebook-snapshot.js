const request = require('request-promise')
const connection = require('../lib/connection')
const getRedditPosts = require('../lib/getRedditPosts')
const getQGroups = require('../lib/getQGroups')
const urljs = require('url')

return connection.query(`
  SELECT reddit_posts.* FROM reddit_posts, urls, domains
    WHERE reddit_posts.url_id = urls.id
      AND urls.domain_id = domains.id
      AND domains.is_ignored = 0
    ORDER BY snapshot_added_at ASC LIMIT 1;
`).then((posts) => {
  const post = posts[0]
  console.log(post.id)
  const api_url = `https://www.reddit.com/r/all/comments/${post.id}.json`
  return request(api_url).then((body) => {
    const data = JSON.parse(body)[0].data.children[0].data
    const score = data.score
    console.log(score)
    const comments_count = data.num_comments
    console.log(comments_count)
    return connection.query(`
      UPDATE reddit_posts
        SET score = ?, comments_count = ?, snapshot_added_at = NOW()
        WHERE id = ?;
      INSERT INTO reddit_post_snapshots(post_id, score, comments_count)
        VALUES(?, ?, ?);
    `, [
      score, comments_count, post.id,
      post.id, score, comments_count
    ])
  })
}).finally(() => {
  connection.end()
})
