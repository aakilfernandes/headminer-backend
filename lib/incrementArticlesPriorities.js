const mysqlQuery = require('./mysqlQuery')
const _ = require('lodash')
const getQs = require('./getQs')
const promise = require('bluebird')

function PriorityConfig(priority_field, at_field, _wait_ms) {
  const wait_ms = _wait_ms || 600000
  return _.merge(this, { priority_field, at_field, wait_ms })
}

const article_priority_configs = [
  new PriorityConfig('coallesce_priority', 'coallesced_at'),
  new PriorityConfig('twitter_influencify_priority', 'twitter_influencified_at'),
  new PriorityConfig('heatify_priority', 'heatified_at')
]

const url_priority_configs = [
  new PriorityConfig('scrape_priority', 'scraped_at'),
  new PriorityConfig('twitter_statuses_add_priority', 'twitter_statuses_added_at'),
  new PriorityConfig('twitter_influencify_priority', 'twitter_influencified_at'),
  new PriorityConfig('facebook_snapshot_add_priority', 'facebook_snapshot_added_at')
]

module.exports = function incrementArticlesPriorities(articles) {

  const now = Date.now()

  const article_ids_by_priority_field = {}
  const url_ids_by_priority_field = {}

  _.forEach(article_priority_configs, (config) => {
    article_ids_by_priority_field[config.priority_field] = []
  })

  _.forEach(url_priority_configs, (config) => {
    url_ids_by_priority_field[config.priority_field] = []
  })

  articles.forEach((article) => {

      const queries = []

      article_priority_configs.forEach((config) => {
        if (now - article[config.at_field] > config.wait_ms) {
          article_ids_by_priority_field[config.priority_field].push(article.id)
        }
      })

      article.url_pojos.forEach((url_pojo) => {
        url_priority_configs.forEach((config) => {
          if (now - url_pojo[config.at_field] > config.wait_ms) {
            url_ids_by_priority_field[config.priority_field].push(url_pojo.id)
          }
        })
      })
  })

  const queries = []
  const values = []

  _.forEach(article_priority_configs, (config) => {
    const ids = article_ids_by_priority_field[config.priority_field]
    if (ids.length === 0) { return }
    const ids_qs = getQs(ids.length)
    values.push(...ids)
    queries.push(`
      UPDATE articles
      SET ${config.priority_field} = ${config.priority_field} + 1
      WHERE id IN (${ids_qs});
    `)
  })

  _.forEach(url_priority_configs, (config) => {
    const ids = url_ids_by_priority_field[config.priority_field]
    if (ids.length === 0) { return }
    const ids_qs = getQs(ids.length)
    values.push(...ids)
    queries.push(`
      UPDATE urls
      SET ${config.priority_field} = ${config.priority_field} + 1
      WHERE id IN (${ids_qs});
    `)
  })

  if (queries.length === 0) {
    return Promise.resolve()
  }

  return mysqlQuery(queries.join('\r\n'), values)
}
