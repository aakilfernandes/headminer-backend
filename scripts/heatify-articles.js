const connection = require('connection')
const getQs = require('../lib/getQs')

return connection.query(`
  SELECT * FROM articles
  WHERE coallesced_at IS NOT NULL
  ORDER BY id ASC LIMIT 1
`).then((articles) => {

  const queries = []
  const values = []

  articles.forEach((article) => {
    const reddit_heat = reddit_posts.length + reddit_score
    const twitter_heat = twitter_statuses_count / 250
    const social_heat = Math.log10(Math.abs(reddit_heat) + twitter_heat) || 0
    // TODO: Add time factor
    const heat = social_heat.toFixed(4)
    queries.push('UPDATE articles SET heat = ? WHERE id = ?;')
    values.push(heat, article.id)
  })

  const query = queries.join('\r\n')

  return connection.query(query, values)
}).finally(() => {
  connection.end()
})
