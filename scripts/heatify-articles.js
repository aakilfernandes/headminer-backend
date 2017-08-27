const connection = require('../lib/connection')
const getQs = require('../lib/getQs')

return connection.query(`
  SELECT * FROM articles
  WHERE coallesced_at IS NOT NULL
  ORDER BY heatified_at ASC, id ASC LIMIT 1000;
`).then((articles) => {

  const queries = []
  const values = []

  articles.forEach((article) => {
    const average_reddit_post_count = 1.7
    const average_twitter_statuses_count = 258.5

    const reddit_post_count_heat = article.reddit_posts_count / average_reddit_post_count
    const reddit_score_count_heat = article.reddit_score
    const twitter_heat = article.twitter_statuses_count / average_twitter_statuses_count

    const heat = [reddit_post_count_heat, reddit_score_count_heat, twitter_heat].reduce((sum, _heat) => {
      if (_heat <= 0) {
        return sum
      }
      return sum + Math.log10(1 + _heat)
    }, 0).toFixed(4)

    queries.push('UPDATE articles SET heat = ?, heatified_at = NOW() WHERE id = ?;')
    values.push(heat, article.id)
  })

  const query = queries.join('\r\n')

  return connection.query(query, values)
}).finally(() => {
  connection.end()
})
