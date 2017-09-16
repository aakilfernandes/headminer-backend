const mysqlQuery = require('./mysqlQuery')
const _ = require('lodash')
const getQs = require('./getQs')

module.exports = function incrementArticlesPriorities(articles) {
  const article_ids = _.map(articles, 'id')
  const article_ids_qs = getQs(article_ids.length)
  return mysqlQuery(`
    UPDATE articles
      SET coallesce_priority = coallesce_priority + 1,
      WHERE id IN (${article_ids_qs})
        AND coallesced_at > NOW() - INTERVAL 10 MINUTE;
    UPDATE articles
      SET twitter_influenceify_priority = twitter_influenceify_priority + 1,
      WHERE id IN (${article_ids_qs})
        AND twitter_influenceified_at > NOW() - INTERVAL 10 MINUTE;
    UPDATE articles
      SET heatify_priority = heatify_priority + 1,
      WHERE id IN (${article_ids_qs})
        AND heatified_at > NOW() - INTERVAL 10 MINUTE;
  `, [article_ids])
}
