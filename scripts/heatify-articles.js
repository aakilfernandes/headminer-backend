const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const getQs = require('../lib/getQs')

const now = new Date
const timezone_offset = now.getTimezoneOffset() * 60 * 1000
const now_utc = now.getTime() + timezone_offset
const period_ms = 1000 * 60 * 60 * 4

return mysqlQuery(`
  SELECT * FROM articles
  ORDER BY id DESC LIMIT 1;

  SELECT AVG(reddit_score) FROM articles;
  SELECT AVG(twitter_statuses_count) FROM articles;
  SELECT AVG(facebook_share_count) FROM articles;
`).then((results) => {
  const articles = results[0]
  const average_reddit_score = results[1][0]['AVG(reddit_score)']
  const average_twitter_statuses_count = results[2][0]['AVG(twitter_statuses_count)']
  const average_facebook_share_count = results[3][0]['AVG(facebook_share_count)']

  const queries = []
  const values = []

  articles.forEach((article, index) => {

    const reddit_score_count_heat = article.reddit_score / average_reddit_score
    const twitter_heat = article.twitter_statuses_count / average_twitter_statuses_count
    const facebook_share_count_heat = article.facebook_share_count / average_facebook_share_count

    const untimed_heat = [
      reddit_score_count_heat,
      twitter_heat,
      facebook_share_count_heat
    ].reduce((sum, _heat) => {
      if (_heat <= 0) {
        return sum
      }
      const logged_heat = Math.log10(1 + _heat)
      return sum + logged_heat
    }, 0)

    const periods = (now_utc - new Date(article.created_at)) / period_ms
    const heat = untimed_heat / Math.max(1, periods)

    queries.push('UPDATE articles SET heat = ?, heatified_at = NOW() WHERE id = ?;')
    values.push(heat, article.id)
  })

  const query = queries.join('\r\n')

  return mysqlQuery(query, values)
}).finally(() => {
  return mysqlDisconnect()
})
