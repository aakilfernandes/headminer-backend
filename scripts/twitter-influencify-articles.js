const mysqlQuery = require('../lib/mysqlQuery')
const getQs = require('../lib/getQs')
const _ = require('lodash')

const queries = []
const values = []

mysqlQuery(`
  SELECT * FROM articles
  WHERE created_at > NOW() - 48 HOURS
  ORDER BY twitter_influencified_at ASC, id ASC
  LIMIT 10;
`).then((articles) => {
  const article_ids = _.map(articles, 'id')
  const article_ids_qs = getQs(article_ids.length)
  return mysqlQuery(`
    UPDATE articles SET twitter_influencified_at = NOW() WHERE id IN (${article_ids_qs});
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
        SELECT (
          (
            (
              (twitter_articles_influences.influence / articles.twitter_statuses_count)
              - twitter_influencers.influence_pts_average
            )
            / twitter_influencers.influence_pts_wstdev
          )
        )
        FROM twitter_influencers, articles
        WHERE twitter_articles_influences.article_id = articles.id
        	AND twitter_articles_influences.influencer_id = twitter_influencers.id
      )
      WHERE twitter_articles_influences.article_id IN (${article_ids_qs});
    `)
    values.push(...article_ids)

    const query = queries.join('\r\n')
    return mysqlQuery(query, values)
  })
}).finally(() => {
  process.exit()
})
