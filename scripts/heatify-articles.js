const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const getQs = require('../lib/getQs')
const _ = require('lodash')

const period_ms = 1000 * 60 * 60 * 4

return mysqlQuery(`
  SELECT * FROM articles
  WHERE twitter_statuses_count IS NOT NULL
    AND facebook_share_count IS NOT NULL
    AND created_at > NOW() - INTERVAL 48 HOUR
  ORDER BY heatify_priority DESC, heatified_at ASC, id ASC LIMIT 10000;

  SELECT AVG(reddit_score) FROM articles;
  SELECT AVG(twitter_statuses_count) FROM articles;
  SELECT AVG(facebook_share_count) FROM articles;
`).then((results) => {
  const articles = results[0]
  if (articles.length === 0) {
    return
  }
  const article_ids = _.map(articles, 'id')
  const article_ids_qs = getQs(article_ids.length)
  return mysqlQuery(`
    UPDATE articles SET heatified_at = NOW(), heatify_priority = 0 WHERE id IN(${article_ids_qs})
  `, article_ids).then(() => {

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

      const periods = (Date.now() - new Date(article.created_at)) / period_ms
      const heat = untimed_heat / Math.max(1, periods)

      queries.push('UPDATE articles SET heat = ? WHERE id = ?;')
      values.push(heat, article.id)
    })

    const query = queries.join('\r\n')

    return mysqlQuery(query, values).then(() => {
      return mysqlQuery(`
        INSERT INTO article_snapshots(article_id, heat, reddit_posts_count, reddit_score, twitter_statuses_count, facebook_share_count, facebook_comment_count)
        SELECT id, heat, reddit_posts_count, reddit_score, twitter_statuses_count, facebook_share_count, facebook_comment_count
          FROM articles
          WHERE id IN (${article_ids_qs})
      `, article_ids)
    })
  })
}).finally(() => {
  return mysqlDisconnect()
})
