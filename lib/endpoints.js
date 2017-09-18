const _ = require('lodash')
const mysqlQuery = require('./mysqlQuery')
const getArticles = require('./getArticles')
const incrementArticlesPriorities = require('./incrementArticlesPriorities')
const fs = require('./fs')

function Endpoint(cache_ms, handle, postHandler) {
  _.merge(this, { cache_ms, handle, postHandler })
}

Endpoint.prototype.handleAndCache = function handleAndCache(params, cache_path) {
  return this.handle(params).then((value) => {
    return fs.writeFileAsync(cache_path, JSON.stringify({
      cached_at: Date.now(),
      value
    }, null, 2)).then(() => {
      return value
    })
  })
}

module.exports['publishers/:id'] = new Endpoint(60000, (params) => {
  return mysqlQuery(`SELECT * FROM publishers WHERE id = ?;`, [params.id])
})

module.exports['twitter-influencers/:id'] = new Endpoint(60000, (params) => {
  return mysqlQuery('SELECT * FROM twitter_influencers WHERE id = ?', [params.id])
})

module.exports['articles/:page_index'] = new Endpoint(NaN, (params) => {
  return getArticles(params.page_index)
}, incrementArticlesPriorities)

module.exports['publishers/:id/articles/:page_index'] = new Endpoint(NaN, (params) => {
  return getArticles(params.page_index, null, 'publishers.id = ?', [params.id])
}, incrementArticlesPriorities)

module.exports['twitter-influencers/:id/articles/low-influence/:page_index'] = new Endpoint(NaN, (params) => {
  return getArticles(params.page_index, 'twitter_articles_influences', `
      articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence >= 1
      AND twitter_articles_influences.influencer_id = ?
  `, [params.id])
}, incrementArticlesPriorities)
