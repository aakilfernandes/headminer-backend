const connection = require('../lib/connection')
const getQs = require('../lib/getQs')
const _ = require('lodash')

const queries = []
const values = []

connection.query(`
  SELECT * FROM articles ORDER BY influencified_at ASC, id ASC LIMIT 10;
`).then((articles) => {
  const article_ids = _.map(articles, 'id')
  const article_ids_qs = getQs(article_ids.length)
  return connection.query(`
    UPDATE articles SET influencified_at = NOW() WHERE id IN (${article_ids_qs});
    SELECT twitter_urls_influences.*, article_id FROM twitter_urls_influences, urls
    WHERE twitter_urls_influences.url_id = urls.id
      AND urls.article_id IN (${article_ids_qs});
  `, article_ids.concat(article_ids)).then((results) => {
    const urls_influences = results[1]
    if (urls_influences.length === 0) {
      return
    }

    const urls_influences_by_article_id = _.groupBy(urls_influences, 'article_id')
    articles.forEach((article) => {
      const urls_influences = urls_influences_by_article_id[article.id]
      if (!urls_influences) {
        return
      }
      const urls_influences_by_influencer_id = _.groupBy(urls_influences, 'influencer_id')

      _.forEach(urls_influences_by_influencer_id, (urls_influences, influencer_id) => {
        const influence =  _.sumBy(urls_influences, 'influence')
        queries.push(`
          INSERT IGNORE INTO twitter_articles_influences(article_id, influencer_id, influence)
          VALUES(?, ?, ?)
          ON DUPLICATE KEY UPDATE influence = ?;
        `)
        values.push(article.id, influencer_id, influence, influence)
      })
    })

    const article_ids = _.map(articles, 'id')
    const article_ids_qs = getQs(article_ids.length)
    queries.push(`
      UPDATE twitter_articles_influences
      SET adjusted_influence = (
        SELECT (twitter_articles_influences.influence - (twitter_influencers.average_influence * articles.twitter_statuses_count)) / twitter_influencers.followers_count
        FROM twitter_influencers, articles
        WHERE twitter_articles_influences.article_id = articles.id
        	AND twitter_articles_influences.influencer_id = twitter_influencers.id
      )
      WHERE twitter_articles_influences.article_id IN (${article_ids_qs});
    `)
    values.push(...article_ids)

    const query = queries.join('\r\n')
    return connection.query(query, values)
  })
}).finally(() => {
  connection.end()
})
