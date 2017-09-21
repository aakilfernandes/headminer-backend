const _ = require('lodash')
const mysqlQuery = require('./mysqlQuery')
const getArticles = require('./getArticles')
const incrementArticlesPriorities = require('./incrementArticlesPriorities')
const fs = require('./fs')
const getCachePath = require('./getCachePath')

function Endpoint(pattern, cache_ms, handle, postHandle) {
  _.merge(this, { pattern, cache_ms, handle, postHandle })
}

Endpoint.prototype.handleAndCache = function handleAndCache(params) {
  const cache_path = this.getCachePath(params)
  return this.handle(params).then((value) => {
    return fs.writeFileAsync(cache_path, JSON.stringify({
      cached_at: Date.now(),
      value
    }, null, 2)).then(() => {
      return value
    })
  })
}

Endpoint.prototype.getUrl = function getUrl(params) {
  let url = this.pattern
  _.forEach(params, (value, key) => {
    url = url.replace(`:${key}`, value)
  })
  return url
}

Endpoint.prototype.getCachePath = function _getCachePath(params) {
  return getCachePath(this.getUrl(params))
}


module.exports.publisher = new Endpoint('publishers/:id', 60000, (params) => {
  return mysqlQuery(`SELECT * FROM publishers WHERE id = ?;`, [params.id])
})

module.exports.twitter_influencer = new Endpoint('twitter-influencers/:id', 60000, (params) => {
  return mysqlQuery('SELECT * FROM twitter_influencers WHERE id = ?', [params.id])
})

module.exports.articles = new Endpoint('articles/:page_index', NaN, (params) => {
  return getArticles(params.page_index)
}, incrementArticlesPriorities)

module.exports.publisher_articles = new Endpoint('publishers/:id/articles/:page_index', NaN, (params) => {
  return getArticles(params.page_index, null, 'publishers.id = ?', [params.id])
}, incrementArticlesPriorities)

module.exports.twitter_influencer_articles_high_influence = new Endpoint('twitter-influencers/:id/articles/low-influence/:page_index', NaN, (params) => {
  return getArticles(params.page_index, 'twitter_articles_influences', `
      articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence >= 1
      AND twitter_articles_influences.influencer_id = ?
  `, [params.id])
}, incrementArticlesPriorities)

module.exports.article_snapshot_stats = new Endpoint('article-snapshot-stats', 0, (params) => {
  const keys = [
    'heat',
    'facebook_share_count',
    'facebook_comment_count',
    'reddit_score',
    'twitter_statuses_count',
  ]
  const queries = keys.map((key) => {
    return `
      SELECT MAX(${key}) AS value FROM articles;
      SELECT MIN(${key}) AS value FROM articles;
    `
  })
  return mysqlQuery(queries.join('\r\n')).then((results) => {
    const stats = {}
    keys.forEach((key, index) => {
      stats[key] = {
        max: results[index * 2][0].value,
        min: results[index * 2 + 1][0].value
      }
      stats[key].range = stats[key].max - stats[key].min
    })
    return stats
  })
})
