const _ = require('lodash')
const mysqlQuery = require('./mysqlQuery')
const Promise = require('bluebird')
const getQs = require('./getQs')

const page_size = 10

module.exports = function getArticles(_page_index, _tables_query, _where_query, _values) {
  
  const page_index = parseInt(_page_index)
  const tables_query = _tables_query ? `, ${_tables_query}` : ''
  const where_query = _where_query ? `AND ${_where_query}` : ''
  const values = _values || []
  values.push(page_size, page_size * page_index)
  return mysqlQuery(`
    SELECT
        articles.*,
        urls.url,
        publishers.id AS publisher_id,
        publishers.name AS publisher_name
      FROM articles, urls, domains, publishers${tables_query}
      WHERE articles.id = urls.article_id
        AND urls.id = urls.canonical_url_id
        AND urls.domain_id = domains.id
        AND domains.publisher_id = publishers.id
        AND domains.is_ignored = 0
        ${where_query}
      ORDER BY heat DESC
      LIMIT ?
      OFFSET ?;
  `, values).then((_articles) => {

    const articles = _.uniqBy(_articles, 'id')
    // edge cases where 2 canonical urls ie bbc.com and bbc.co.uk

    if (articles.length === 0) {
      return articles
    }

    articles.forEach((article) => {
      article.url_pojos = []
      article.snapshots = []
      article.twitter_influencers = []
    })

    const articles_by_id = _.keyBy(articles, 'id')

    const article_ids = _.map(articles, 'id')
    const article_ids_qs = getQs(article_ids.length)

    return mysqlQuery(`
      SELECT * FROM urls WHERE article_id IN (${article_ids_qs});
      SELECT * FROM article_snapshots
        WHERE article_id IN (${article_ids_qs})
        ORDER BY created_at ASC;
      SELECT
          twitter_influencers.*, twitter_articles_influences.article_id,
          twitter_articles_influences.influence,
          twitter_articles_influences.adjusted_influence
        FROM twitter_influencers, twitter_articles_influences
        WHERE twitter_articles_influences.article_id IN (${article_ids_qs})
          AND twitter_influencers.id = twitter_articles_influences.influencer_id
          AND twitter_influencers.is_ignored = 0
        ORDER BY twitter_articles_influences.adjusted_influence DESC;
    `, article_ids.concat(article_ids).concat(article_ids)).then((results) => {
      const url_pojos = results[0]
      const snapshots = results[1]
      const twitter_influencers = results[2]

      url_pojos.forEach((url_pojo) => {
        articles_by_id[url_pojo.article_id].url_pojos.push(url_pojo)
      })

      snapshots.forEach((snapshot) => {
        articles_by_id[snapshot.article_id].snapshots.push(snapshot)
      })

      twitter_influencers.forEach((twitter_influencer) => {
        articles_by_id[twitter_influencer.article_id].twitter_influencers.push(twitter_influencer)
      })

      return articles
    })

  })
}
